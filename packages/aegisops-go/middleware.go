package aegisops

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type responseRecorder struct {
	http.ResponseWriter
	statusCode  int
	wroteHeader bool
}

func (recorder *responseRecorder) WriteHeader(statusCode int) {
	if recorder.wroteHeader {
		return
	}
	recorder.statusCode = statusCode
	recorder.wroteHeader = true
	recorder.ResponseWriter.WriteHeader(statusCode)
}

func (recorder *responseRecorder) Write(data []byte) (int, error) {
	if !recorder.wroteHeader {
		recorder.WriteHeader(http.StatusOK)
	}
	return recorder.ResponseWriter.Write(data)
}

func Middleware(cfg Config) func(http.Handler) http.Handler {
	client := NewClient(cfg)
	return client.Middleware
}

func (client *Client) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if client.shouldIgnoreRoute(path) {
			next.ServeHTTP(w, r)
			return
		}

		started := time.Now()
		requestID := firstNonEmpty(r.Header.Get("x-request-id"), r.Header.Get("x-correlation-id"), randomID())
		traceID := firstNonEmpty(r.Header.Get("x-trace-id"), r.Header.Get("traceparent"), randomID())
		w.Header().Set("x-request-id", requestID)
		w.Header().Set("x-trace-id", traceID)

		recorder := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		defer func() {
			recovered := recover()
			if recovered != nil && !recorder.wroteHeader {
				http.Error(recorder, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			}
			durationMS := float64(time.Since(started).Microseconds()) / 1000.0
			statusCode := recorder.statusCode
			if recovered != nil {
				statusCode = http.StatusInternalServerError
			}
			route := path
			labels := map[string]string{"method": r.Method, "route": route, "statusCode": intString(statusCode)}
			metrics := []Metric{
				{MetricName: "http_requests_total", Value: 1, Labels: labels},
				{MetricName: "http_request_duration_ms", Value: durationMS, Labels: labels},
			}
			if statusCode >= 400 {
				metrics = append(metrics, Metric{MetricName: "http_errors_total", Value: 1, Labels: labels})
			}
			if statusCode >= 500 {
				metrics = append(metrics, Metric{MetricName: "http_5xx_total", Value: 1, Labels: labels})
			} else if statusCode >= 400 {
				metrics = append(metrics, Metric{MetricName: "http_4xx_total", Value: 1, Labels: labels})
			}
			if time.Since(started) >= client.cfg.SlowRequestThreshold {
				metrics = append(metrics, Metric{MetricName: "slow_requests_total", Value: 1, Labels: labels})
			}
			if recovered != nil {
				metrics = append(metrics, Metric{MetricName: "exceptions_total", Value: 1, Labels: labels})
			}
			client.SendBatchMetrics(context.Background(), metrics)

			metadata := map[string]interface{}{
				"route":       route,
				"method":      r.Method,
				"statusCode":  statusCode,
				"durationMs":  durationMS,
				"requestId":   requestID,
				"traceId":     traceID,
				"userAgent":   r.UserAgent(),
				"ip":          clientIP(r),
				"projectKey":  client.cfg.ProjectKey,
				"serviceName": client.cfg.ServiceName,
				"environment": client.cfg.Environment,
			}
			if recovered != nil {
				metadata["panic"] = recovered
				client.SendLog(context.Background(), Log{
					Level:      "error",
					Message:    "Unhandled panic",
					RequestID:  requestID,
					TraceID:    traceID,
					Route:      route,
					Method:     r.Method,
					StatusCode: http.StatusInternalServerError,
					DurationMS: durationMS,
					Metadata:   metadata,
				})
				return
			}
			if time.Since(started) >= client.cfg.SlowRequestThreshold {
				client.SendLog(context.Background(), Log{
					Level:      "warn",
					Message:    "Slow request " + r.Method + " " + route,
					RequestID:  requestID,
					TraceID:    traceID,
					Route:      route,
					Method:     r.Method,
					StatusCode: statusCode,
					DurationMS: durationMS,
					Metadata:   metadata,
				})
			}
			if statusCode >= 500 {
				client.SendLog(context.Background(), Log{
					Level:      "error",
					Message:    "HTTP " + intString(statusCode) + " " + r.Method + " " + route,
					RequestID:  requestID,
					TraceID:    traceID,
					Route:      route,
					Method:     r.Method,
					StatusCode: statusCode,
					DurationMS: durationMS,
					Metadata:   metadata,
				})
			}
		}()

		next.ServeHTTP(recorder, r)
	})
}

func (client *Client) shouldIgnoreRoute(path string) bool {
	for _, route := range client.cfg.IgnoredRoutes {
		if path == route || strings.HasPrefix(path, strings.TrimRight(route, "/")+"/") {
			return true
		}
	}
	return false
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func randomID() string {
	var data [16]byte
	if _, err := rand.Read(data[:]); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(data[:])
}

func intString(value int) string {
	return strconv.Itoa(value)
}

func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("x-forwarded-for"); forwarded != "" {
		return strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
