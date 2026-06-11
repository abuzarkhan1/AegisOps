package aegisops

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

type capturedRequest struct {
	Path string
	Body map[string]interface{}
}

func collector(t *testing.T) (*httptest.Server, *[]capturedRequest, *sync.Mutex) {
	t.Helper()
	var mu sync.Mutex
	requests := []capturedRequest{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode request: %v", err)
		}
		mu.Lock()
		requests = append(requests, capturedRequest{Path: r.URL.Path, Body: body})
		mu.Unlock()
		w.WriteHeader(http.StatusAccepted)
	}))
	return server, &requests, &mu
}

func testConfig(apiURL string) Config {
	return Config{
		Enabled:              true,
		APIURL:               apiURL,
		APIKey:               "aeg_test",
		ProjectKey:           "project",
		ServiceName:          "service",
		Environment:          "test",
		BatchSize:            1,
		FlushInterval:        time.Hour,
		SlowRequestThreshold: time.Millisecond,
		Timeout:              time.Second,
	}
}

func TestBatchingFlushesByBatchSize(t *testing.T) {
	server, requests, mu := collector(t)
	defer server.Close()
	client := NewClient(testConfig(server.URL))
	defer client.Shutdown(context.Background())

	client.SendMetric(context.Background(), Metric{MetricName: "one", Value: 1})

	mu.Lock()
	defer mu.Unlock()
	if len(*requests) != 1 {
		t.Fatalf("expected one request, got %d", len(*requests))
	}
	if (*requests)[0].Path != "/metrics-api/metrics/batch" {
		t.Fatalf("unexpected path %s", (*requests)[0].Path)
	}
}

func TestDisabledClientSendsNothing(t *testing.T) {
	server, requests, mu := collector(t)
	defer server.Close()
	cfg := testConfig(server.URL)
	cfg.Enabled = false
	client := NewClient(cfg)
	defer client.Shutdown(context.Background())

	client.SendLog(context.Background(), Log{Message: "disabled"})
	client.SendMetric(context.Background(), Metric{MetricName: "disabled", Value: 1})
	client.Flush(context.Background())

	mu.Lock()
	defer mu.Unlock()
	if len(*requests) != 0 {
		t.Fatalf("expected no requests, got %d", len(*requests))
	}
}

func TestMiddlewareCapturesRequest(t *testing.T) {
	server, requests, mu := collector(t)
	defer server.Close()
	client := NewClient(testConfig(server.URL))
	defer client.Shutdown(context.Background())

	handler := client.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	}))
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/boom", nil)
	req.Header.Set("x-request-id", "req_1")
	handler.ServeHTTP(recorder, req)

	if recorder.Header().Get("x-request-id") != "req_1" {
		t.Fatal("missing request id response header")
	}
	mu.Lock()
	defer mu.Unlock()
	foundErrorMetric := false
	foundErrorLog := false
	for _, request := range *requests {
		if request.Path == "/metrics-api/metrics/batch" {
			for _, rawMetric := range request.Body["metrics"].([]interface{}) {
				metric := rawMetric.(map[string]interface{})
				if metric["metricName"] == "http_5xx_total" {
					foundErrorMetric = true
				}
			}
		}
		if request.Path == "/ingest/logs" && request.Body["level"] == "error" {
			foundErrorLog = true
		}
	}
	if !foundErrorMetric || !foundErrorLog {
		t.Fatalf("expected error metric/log, metric=%v log=%v", foundErrorMetric, foundErrorLog)
	}
}

func TestMiddlewareRecoversPanicWithExceptionTelemetry(t *testing.T) {
	server, requests, mu := collector(t)
	defer server.Close()
	client := NewClient(testConfig(server.URL))
	defer client.Shutdown(context.Background())

	handler := client.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	}))
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 response, got %d", recorder.Code)
	}
	mu.Lock()
	defer mu.Unlock()
	foundExceptionMetric := false
	foundExceptionLog := false
	for _, request := range *requests {
		if request.Path == "/metrics-api/metrics/batch" {
			for _, rawMetric := range request.Body["metrics"].([]interface{}) {
				metric := rawMetric.(map[string]interface{})
				if metric["metricName"] == "exceptions_total" {
					foundExceptionMetric = true
				}
			}
		}
		if request.Path == "/ingest/logs" && request.Body["message"] == "Unhandled panic" {
			foundExceptionLog = true
		}
	}
	if !foundExceptionMetric || !foundExceptionLog {
		t.Fatalf("expected exception metric/log, metric=%v log=%v", foundExceptionMetric, foundExceptionLog)
	}
}
