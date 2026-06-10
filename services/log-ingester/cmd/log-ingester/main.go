package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/segmentio/kafka-go"
)

type logPayload struct {
	ServiceName string                 `json:"serviceName"`
	Level       string                 `json:"level"`
	Message     string                 `json:"message"`
	Timestamp   string                 `json:"timestamp"`
	TraceID     string                 `json:"traceId,omitempty"`
	Environment string                 `json:"environment"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type batchLogPayload struct {
	Logs []logPayload `json:"logs"`
}

type checkResult struct {
	Status string `json:"status"`
	Detail string `json:"detail,omitempty"`
}

type apiKeyValidator struct {
	redisAddr  string
	coreAPIURL string
	httpClient *http.Client
}

var logsReceived = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "aegisops_logs_received_total",
		Help: "Total log payloads received by the log ingester",
	},
	[]string{"service_name", "level", "environment"},
)

func main() {
	serviceName := getenv("SERVICE_NAME", "log-ingester")
	port := getenv("PORT", "5001")
	brokers := splitCSV(getenv("KAFKA_BROKERS", "localhost:9094"))
	redisAddr := getenv("REDIS_ADDR", "localhost:6379")
	coreAPIURL := strings.TrimRight(getenv("CORE_API_URL", "http://localhost:4000"), "/")

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	prometheus.MustRegister(logsReceived)

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "logs.received",
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireOne,
		Async:        false,
	}
	defer writer.Close()
	validator := newAPIKeyValidator(redisAddr, coreAPIURL)

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", healthHandler(serviceName, brokers, redisAddr, coreAPIURL))
	mux.HandleFunc("/logs", logsHandler(logger, writer, validator))
	mux.HandleFunc("/ingest/logs", logsHandler(logger, writer, validator))
	mux.HandleFunc("/logs/batch", batchLogsHandler(logger, writer, validator))
	mux.HandleFunc("/ingest/logs/batch", batchLogsHandler(logger, writer, validator))

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           requestLogger(logger, mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("Log ingester ready", "port", port, "kafkaBrokers", brokers, "topic", "logs.received", "coreAPIURL", coreAPIURL)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Log ingester stopped unexpectedly", "error", err)
			os.Exit(1)
		}
	}()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)
	<-shutdown

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Graceful shutdown failed", "error", err)
	}
}

func logsHandler(logger *slog.Logger, writer *kafka.Writer, validator *apiKeyValidator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if !authorizeRequest(w, r, logger, validator) {
			return
		}

		apiKey := r.Header.Get("X-API-Key")
		limited, err := isRateLimited(r.Context(), validator.redisAddr, "ingest", apiKey, 1000)
		if err != nil {
			logger.Error("Rate limit check failed", "error", err)
		} else if limited {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
			return
		}

		var payload logPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}

		if err := validateLogPayload(payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := publishLog(ctx, writer, payload); err != nil {
			logger.Error("Failed to publish log payload", "error", err, "topic", "logs.received")
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to publish log payload"})
			return
		}

		logsReceived.WithLabelValues(payload.ServiceName, payload.Level, payload.Environment).Inc()
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "accepted", "topic": "logs.received"})
	}
}

func batchLogsHandler(logger *slog.Logger, writer *kafka.Writer, validator *apiKeyValidator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if !authorizeRequest(w, r, logger, validator) {
			return
		}

		apiKey := r.Header.Get("X-API-Key")
		limited, err := isRateLimited(r.Context(), validator.redisAddr, "ingest-batch", apiKey, 300)
		if err != nil {
			logger.Error("Rate limit check failed", "error", err)
		} else if limited {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
			return
		}

		var payload batchLogPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		if len(payload.Logs) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "logs must contain at least one item"})
			return
		}
		if len(payload.Logs) > 500 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "logs batch cannot exceed 500 items"})
			return
		}
		for index, item := range payload.Logs {
			if err := validateLogPayload(item); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("logs[%d]: %s", index, err.Error())})
				return
			}
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		messages := make([]kafka.Message, 0, len(payload.Logs))
		for _, item := range payload.Logs {
			message, err := logMessage(item)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to encode Kafka message"})
				return
			}
			messages = append(messages, message)
		}
		if err := writer.WriteMessages(ctx, messages...); err != nil {
			logger.Error("Failed to publish log batch", "error", err, "topic", "logs.received", "count", len(messages))
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to publish log batch"})
			return
		}

		for _, item := range payload.Logs {
			logsReceived.WithLabelValues(item.ServiceName, item.Level, item.Environment).Inc()
		}
		writeJSON(w, http.StatusAccepted, map[string]interface{}{"status": "accepted", "topic": "logs.received", "count": len(payload.Logs)})
	}
}

func authorizeRequest(w http.ResponseWriter, r *http.Request, logger *slog.Logger, validator *apiKeyValidator) bool {
	valid, detail, err := validator.validate(r.Context(), r.Header.Get("X-API-Key"))
	if err != nil {
		logger.Error("API key validation failed", "error", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "api key validation unavailable"})
		return false
	}
	if !valid {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": detail})
		return false
	}
	return true
}

func publishLog(ctx context.Context, writer *kafka.Writer, payload logPayload) error {
	message, err := logMessage(payload)
	if err != nil {
		return err
	}
	return writer.WriteMessages(ctx, message)
}

func logMessage(payload logPayload) (kafka.Message, error) {
	body, err := json.Marshal(map[string]interface{}{
		"eventType":   "logs.received",
		"serviceName": payload.ServiceName,
		"level":       payload.Level,
		"message":     payload.Message,
		"timestamp":   payload.Timestamp,
		"traceId":     payload.TraceID,
		"environment": payload.Environment,
		"metadata":    payload.Metadata,
		"receivedAt":  time.Now().UTC().Format(time.RFC3339Nano),
	})
	if err != nil {
		return kafka.Message{}, err
	}
	return kafka.Message{
		Key:   []byte(payload.ServiceName + ":" + payload.Environment),
		Value: body,
	}, nil
}

func healthHandler(serviceName string, brokers []string, redisAddr string, coreAPIURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		coreCheck := checkHTTP(coreAPIURL + "/health")
		checks := map[string]checkResult{
			"kafka":    checkTCP(firstOrDefault(brokers, "localhost:9094")),
			"redis":    checkTCP(redisAddr),
			"core_api": coreCheck,
		}

		status := "ok"
		for _, check := range checks {
			if check.Status != "ok" {
				status = "degraded"
				break
			}
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  status,
			"service": serviceName,
			"topic":   "logs.received",
			"checks":  checks,
		})
	}
}

func newAPIKeyValidator(redisAddr string, coreAPIURL string) *apiKeyValidator {
	return &apiKeyValidator{
		redisAddr:  redisAddr,
		coreAPIURL: coreAPIURL,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}
}

func (validator *apiKeyValidator) validate(ctx context.Context, rawKey string) (bool, string, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return false, "X-API-Key header is required", nil
	}

	keyHash := hashAPIKey(rawKey)
	cacheKey := "api-key-validation:" + keyHash
	if cached, err := redisGet(ctx, validator.redisAddr, cacheKey); err == nil && cached == "valid" {
		return true, "valid", nil
	}

	body, err := json.Marshal(map[string]string{"apiKey": rawKey})
	if err != nil {
		return false, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, validator.coreAPIURL+"/api/api-keys/validate", bytes.NewReader(body))
	if err != nil {
		return false, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := validator.httpClient.Do(req)
	if err != nil {
		return false, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 500 {
		return false, "", fmt.Errorf("core api returned %d", resp.StatusCode)
	}

	var validation struct {
		Valid bool `json:"valid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&validation); err != nil {
		return false, "", err
	}
	if validation.Valid {
		_ = redisSetEX(ctx, validator.redisAddr, cacheKey, "valid", 15*time.Minute)
		return true, "valid", nil
	}
	return false, "invalid API key", nil
}

func redisGet(ctx context.Context, addr string, key string) (string, error) {
	response, err := redisCommand(ctx, addr, "GET", key)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(response, "$-1") {
		return "", errors.New("cache miss")
	}
	lines := strings.Split(response, "\r\n")
	if len(lines) >= 2 && strings.HasPrefix(lines[0], "$") {
		return lines[1], nil
	}
	return "", fmt.Errorf("unexpected redis GET response")
}

func redisSetEX(ctx context.Context, addr string, key string, value string, ttl time.Duration) error {
	_, err := redisCommand(ctx, addr, "SETEX", key, fmt.Sprintf("%d", int(ttl.Seconds())), value)
	return err
}

func isRateLimited(ctx context.Context, redisAddr string, scope string, identifier string, limit int) (bool, error) {
	if identifier == "" {
		return false, nil
	}
	minute := time.Now().UTC().Format("200601021504") // YYYYMMDDHHMM
	key := fmt.Sprintf("rate-limit:%s:%s:%s", scope, identifier, minute)

	resp, err := redisCommand(ctx, redisAddr, "INCR", key)
	if err != nil {
		return false, err
	}

	if !strings.HasPrefix(resp, ":") {
		return false, fmt.Errorf("unexpected redis response for rate limit: %s", resp)
	}

	valStr := strings.TrimSuffix(strings.TrimPrefix(resp, ":"), "\r")
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return false, err
	}

	if val == 1 {
		_, _ = redisCommand(ctx, redisAddr, "EXPIRE", key, "60")
	}

	return val > limit, nil
}

func redisCommand(ctx context.Context, addr string, args ...string) (string, error) {
	dialer := net.Dialer{Timeout: 1200 * time.Millisecond}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(1200 * time.Millisecond))

	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("*%d\r\n", len(args)))
	for _, arg := range args {
		builder.WriteString(fmt.Sprintf("$%d\r\n%s\r\n", len(arg), arg))
	}
	if _, err := conn.Write([]byte(builder.String())); err != nil {
		return "", err
	}
	reader := bufio.NewReader(conn)
	line, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	line = strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r")
	switch {
	case strings.HasPrefix(line, "+") || strings.HasPrefix(line, ":"):
		return line, nil
	case strings.HasPrefix(line, "$"):
		length, err := strconv.Atoi(strings.TrimPrefix(line, "$"))
		if err != nil {
			return "", err
		}
		if length < 0 {
			return "$-1\r\n", nil
		}
		payload := make([]byte, length+2)
		if _, err := io.ReadFull(reader, payload); err != nil {
			return "", err
		}
		return line + "\r\n" + string(payload), nil
	case strings.HasPrefix(line, "-"):
		return "", errors.New(strings.TrimPrefix(line, "-"))
	default:
		return "", fmt.Errorf("unexpected redis response: %s", line)
	}
}

func validateLogPayload(payload logPayload) error {
	if strings.TrimSpace(payload.ServiceName) == "" {
		return errors.New("serviceName is required")
	}
	if strings.TrimSpace(payload.Level) == "" {
		return errors.New("level is required")
	}
	if strings.TrimSpace(payload.Message) == "" {
		return errors.New("message is required")
	}
	if strings.TrimSpace(payload.Timestamp) == "" {
		return errors.New("timestamp is required")
	}
	if strings.TrimSpace(payload.Environment) == "" {
		return errors.New("environment is required")
	}
	if _, err := time.Parse(time.RFC3339, payload.Timestamp); err != nil {
		return errors.New("timestamp must be RFC3339")
	}
	return nil
}

func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request completed", "method", r.Method, "path", r.URL.Path, "durationMs", time.Since(started).Milliseconds())
	})
}

func checkTCP(addr string) checkResult {
	conn, err := net.DialTimeout("tcp", addr, 1200*time.Millisecond)
	if err != nil {
		return checkResult{Status: "degraded", Detail: err.Error()}
	}
	_ = conn.Close()
	return checkResult{Status: "ok"}
}

func checkHTTP(rawURL string) checkResult {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return checkResult{Status: "degraded", Detail: err.Error()}
	}
	port := parsed.Port()
	if port == "" {
		if parsed.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}
	return checkTCP(net.JoinHostPort(parsed.Hostname(), port))
}

func hashAPIKey(rawKey string) string {
	sum := sha256.Sum256([]byte(rawKey))
	return hex.EncodeToString(sum[:])
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func getenv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func firstOrDefault(values []string, fallback string) string {
	if len(values) == 0 {
		return fallback
	}
	return values[0]
}
