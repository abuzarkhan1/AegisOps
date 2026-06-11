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
	OrganizationID string                 `json:"organizationId,omitempty"`
	ProjectID      string                 `json:"projectId,omitempty"`
	ProjectKey     string                 `json:"projectKey,omitempty"`
	ServiceName    string                 `json:"serviceName"`
	ServiceID      string                 `json:"serviceId,omitempty"`
	Level          string                 `json:"level"`
	Message        string                 `json:"message"`
	Timestamp      string                 `json:"timestamp"`
	TraceID        string                 `json:"traceId,omitempty"`
	RequestID      string                 `json:"requestId,omitempty"`
	SpanID         string                 `json:"spanId,omitempty"`
	ParentSpanID   string                 `json:"parentSpanId,omitempty"`
	Route          string                 `json:"route,omitempty"`
	Method         string                 `json:"method,omitempty"`
	StatusCode     *int                   `json:"statusCode,omitempty"`
	DurationMs     *float64               `json:"durationMs,omitempty"`
	Environment    string                 `json:"environment"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
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

type apiKeyContext struct {
	Valid          bool   `json:"valid,omitempty"`
	OrganizationID string `json:"organizationId,omitempty"`
	ProjectID      string `json:"projectId,omitempty"`
	ProjectKey     string `json:"projectKey,omitempty"`
	ServiceID      string `json:"serviceId,omitempty"`
	ServiceName    string `json:"serviceName,omitempty"`
	Environment    string `json:"environment,omitempty"`
	Status         string `json:"status,omitempty"`
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
		Handler:           requestLogger(logger, withCORS(mux)),
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

		apiKey := apiKeyFromRequest(r)
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
		payload = withDefaultLogTimestamp(payload)

		if err := validateLogPayload(payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		keyContext, contextErr := validator.resolveContext(r.Context(), apiKey, payload.ProjectKey, payload.ServiceName)
		if contextErr != nil {
			logger.Error("API key context lookup failed", "error", contextErr)
			writeJSON(w, http.StatusUnauthorized, authErrorResponse("Invalid or revoked API key"))
			return
		}
		payload = enrichLogContext(payload, keyContext)

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := publishLog(ctx, writer, payload); err != nil {
			logger.Error("Failed to publish log payload", "error", err, "topic", "logs.received")
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to publish log payload"})
			return
		}

		logsReceived.WithLabelValues(payload.ServiceName, payload.Level, payload.Environment).Inc()
		if err := evaluateLogAlertRules(r.Context(), validator.coreAPIURL, payload); err != nil {
			logger.Error("Log alert rule evaluation failed", "error", err, "serviceName", payload.ServiceName)
		}
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

		apiKey := apiKeyFromRequest(r)
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
			payload.Logs[index] = withDefaultLogTimestamp(item)
			item = payload.Logs[index]
			if err := validateLogPayload(item); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("logs[%d]: %s", index, err.Error())})
				return
			}
		}

		var projectKey, serviceName string
		if len(payload.Logs) > 0 {
			projectKey = payload.Logs[0].ProjectKey
			serviceName = payload.Logs[0].ServiceName
		}
		keyContext, contextErr := validator.resolveContext(r.Context(), apiKey, projectKey, serviceName)
		if contextErr != nil {
			logger.Error("API key context lookup failed", "error", contextErr)
			writeJSON(w, http.StatusUnauthorized, authErrorResponse("Invalid or revoked API key"))
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		messages := make([]kafka.Message, 0, len(payload.Logs))
		for index, item := range payload.Logs {
			payload.Logs[index] = enrichLogContext(item, keyContext)
			item = payload.Logs[index]
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
			if err := evaluateLogAlertRules(r.Context(), validator.coreAPIURL, item); err != nil {
				logger.Error("Log alert rule evaluation failed", "error", err, "serviceName", item.ServiceName)
			}
		}
		writeJSON(w, http.StatusAccepted, map[string]interface{}{"status": "accepted", "topic": "logs.received", "count": len(payload.Logs)})
	}
}

func authorizeRequest(w http.ResponseWriter, r *http.Request, logger *slog.Logger, validator *apiKeyValidator) bool {
	valid, detail, err := validator.validate(r.Context(), apiKeyFromRequest(r))
	if err != nil {
		logger.Error("API key validation failed", "error", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "api key validation unavailable"})
		return false
	}
	if !valid {
		message := "Invalid or revoked API key"
		if strings.Contains(strings.ToLower(detail), "required") {
			message = "API key required"
		}
		writeJSON(w, http.StatusUnauthorized, authErrorResponse(message))
		return false
	}
	return true
}

func apiKeyFromRequest(r *http.Request) string {
	if apiKey := strings.TrimSpace(r.Header.Get("X-API-Key")); apiKey != "" {
		return apiKey
	}
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "Bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	return ""
}

func publishLog(ctx context.Context, writer *kafka.Writer, payload logPayload) error {
	message, err := logMessage(payload)
	if err != nil {
		return err
	}
	return writer.WriteMessages(ctx, message)
}

func logMessage(payload logPayload) (kafka.Message, error) {
	metadata := enrichLogMetadata(payload)
	body, err := json.Marshal(map[string]interface{}{
		"eventType":      "logs.received",
		"organizationId": payload.OrganizationID,
		"projectId":      payload.ProjectID,
		"projectKey":     payload.ProjectKey,
		"serviceName":    payload.ServiceName,
		"serviceId":      payload.ServiceID,
		"level":          payload.Level,
		"message":        payload.Message,
		"timestamp":      payload.Timestamp,
		"traceId":        payload.TraceID,
		"requestId":      payload.RequestID,
		"spanId":         payload.SpanID,
		"parentSpanId":   payload.ParentSpanID,
		"route":          payload.Route,
		"method":         payload.Method,
		"statusCode":     payload.StatusCode,
		"durationMs":     payload.DurationMs,
		"environment":    payload.Environment,
		"metadata":       metadata,
		"receivedAt":     time.Now().UTC().Format(time.RFC3339Nano),
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
			"status":       status,
			"healthStatus": degradedStatus(status),
			"service":      serviceName,
			"timestamp":    time.Now().UTC().Format(time.RFC3339Nano),
			"mode":         "local",
			"topic":        "logs.received",
			"dependencies": dependencyStatuses(checks, map[string]string{"postgres": "not_required", "rabbitmq": "not_required"}),
			"checks":       checks,
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

func apiKeyContextCacheKey(keyHash string) string {
	return "api-key:" + keyHash + ":context"
}

func orgApiKeyCacheKey(orgID string, keyHash string) string {
	return "org:" + orgID + ":api-key:" + keyHash
}

func (validator *apiKeyValidator) cachedContext(ctx context.Context, keyHash string, projectRef string, serviceRef string) (apiKeyContext, bool) {
	cached, err := redisGet(ctx, validator.redisAddr, apiKeyContextCacheKey(keyHash))
	if err != nil || cached == "" {
		return apiKeyContext{}, false
	}
	var keyContext apiKeyContext
	if err := json.Unmarshal([]byte(cached), &keyContext); err != nil {
		return apiKeyContext{}, false
	}
	if !keyContext.Valid || keyContext.Status == "revoked" {
		return apiKeyContext{}, false
	}
	if !contextMatchesRequest(keyContext, projectRef, serviceRef) {
		return apiKeyContext{}, false
	}
	return keyContext, true
}

func (validator *apiKeyValidator) cacheContext(ctx context.Context, keyHash string, keyContext apiKeyContext) {
	if keyContext.OrganizationID == "" {
		return
	}
	keyContext.Valid = true
	body, err := json.Marshal(keyContext)
	if err != nil {
		return
	}
	_ = redisSetEX(ctx, validator.redisAddr, apiKeyContextCacheKey(keyHash), string(body), 5*time.Minute)
	_ = redisSetEX(ctx, validator.redisAddr, orgApiKeyCacheKey(keyContext.OrganizationID, keyHash), string(body), 5*time.Minute)
}

func contextMatchesRequest(keyContext apiKeyContext, projectRef string, serviceRef string) bool {
	projectRef = strings.TrimSpace(projectRef)
	serviceRef = strings.TrimSpace(serviceRef)
	if projectRef != "" && keyContext.ProjectKey != projectRef && keyContext.ProjectID != projectRef {
		return false
	}
	if serviceRef != "" && keyContext.ServiceName != serviceRef && keyContext.ServiceID != serviceRef {
		return false
	}
	return keyContext.OrganizationID != ""
}

func (validator *apiKeyValidator) validate(ctx context.Context, rawKey string) (bool, string, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return false, "X-API-Key or Authorization Bearer token is required", nil
	}

	keyHash := hashAPIKey(rawKey)
	if _, ok := validator.cachedContext(ctx, keyHash, "", ""); ok {
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
		Valid  bool          `json:"valid"`
		APIKey apiKeyContext `json:"apiKey"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&validation); err != nil {
		return false, "", err
	}
	if validation.Valid {
		validator.cacheContext(ctx, keyHash, validation.APIKey)
		return true, "valid", nil
	}
	return false, "invalid API key", nil
}

func (validator *apiKeyValidator) resolveContext(ctx context.Context, rawKey string, projectKey string, serviceName string) (apiKeyContext, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return apiKeyContext{}, errors.New("X-API-Key or Authorization Bearer token is required")
	}
	keyHash := hashAPIKey(rawKey)
	if keyContext, ok := validator.cachedContext(ctx, keyHash, projectKey, serviceName); ok {
		return keyContext, nil
	}

	body, err := json.Marshal(map[string]string{
		"apiKey":      rawKey,
		"projectKey":  projectKey,
		"serviceName": serviceName,
	})
	if err != nil {
		return apiKeyContext{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, validator.coreAPIURL+"/api/api-keys/validate", bytes.NewReader(body))
	if err != nil {
		return apiKeyContext{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := validator.httpClient.Do(req)
	if err != nil {
		return apiKeyContext{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 500 {
		return apiKeyContext{}, fmt.Errorf("core api returned %d", resp.StatusCode)
	}

	var validation struct {
		Valid   bool   `json:"valid"`
		Message string `json:"message"`
		APIKey  struct {
			OrganizationID string `json:"organizationId"`
			ProjectID      string `json:"projectId"`
			ProjectKey     string `json:"projectKey"`
			ServiceID      string `json:"serviceId"`
			ServiceName    string `json:"serviceName"`
			Environment    string `json:"environment"`
		} `json:"apiKey"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&validation); err != nil {
		return apiKeyContext{}, err
	}
	if !validation.Valid {
		msg := "invalid API key"
		if validation.Message != "" {
			msg = validation.Message
		}
		return apiKeyContext{}, errors.New(msg)
	}
	keyContext := apiKeyContext{
		Valid:          true,
		OrganizationID: validation.APIKey.OrganizationID,
		ProjectID:      validation.APIKey.ProjectID,
		ProjectKey:     validation.APIKey.ProjectKey,
		ServiceID:      validation.APIKey.ServiceID,
		ServiceName:    validation.APIKey.ServiceName,
		Environment:    validation.APIKey.Environment,
	}
	validator.cacheContext(ctx, keyHash, keyContext)
	return keyContext, nil
}

func evaluateLogAlertRules(ctx context.Context, coreAPIURL string, payload logPayload) error {
	if strings.TrimSpace(payload.OrganizationID) == "" {
		return nil
	}
	requestBody := map[string]interface{}{
		"organizationId": payload.OrganizationID,
		"projectId":      payload.ProjectID,
		"serviceId":      payload.ServiceID,
		"serviceName":    payload.ServiceName,
		"environment":    payload.Environment,
		"level":          payload.Level,
		"message":        payload.Message,
		"traceId":        payload.TraceID,
		"requestId":      payload.RequestID,
		"route":          payload.Route,
		"method":         payload.Method,
		"timestamp":      payload.Timestamp,
		"metadata":       enrichLogMetadata(payload),
	}
	if payload.StatusCode != nil {
		requestBody["statusCode"] = *payload.StatusCode
	}
	body, err := json.Marshal(requestBody)
	if err != nil {
		return err
	}
	evalCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(evalCtx, http.MethodPost, strings.TrimRight(coreAPIURL, "/")+"/api/alert-rules/evaluate-log", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		responseBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("core api log alert evaluation returned %d: %s", resp.StatusCode, strings.TrimSpace(string(responseBody)))
	}
	return nil
}

func enrichLogContext(payload logPayload, keyContext apiKeyContext) logPayload {
	payload.OrganizationID = firstNonEmpty(payload.OrganizationID, keyContext.OrganizationID)
	payload.ProjectID = firstNonEmpty(payload.ProjectID, keyContext.ProjectID)
	payload.ProjectKey = firstNonEmpty(payload.ProjectKey, keyContext.ProjectKey)
	payload.ServiceID = firstNonEmpty(payload.ServiceID, keyContext.ServiceID)
	payload.ServiceName = firstNonEmpty(payload.ServiceName, keyContext.ServiceName)
	payload.Environment = firstNonEmpty(payload.Environment, keyContext.Environment, "production")
	return payload
}

func enrichLogMetadata(payload logPayload) map[string]interface{} {
	metadata := make(map[string]interface{})
	for key, value := range payload.Metadata {
		metadata[key] = value
	}
	if payload.RequestID != "" {
		metadata["requestId"] = payload.RequestID
	}
	if payload.SpanID != "" {
		metadata["spanId"] = payload.SpanID
	}
	if payload.ParentSpanID != "" {
		metadata["parentSpanId"] = payload.ParentSpanID
	}
	if payload.Route != "" {
		metadata["route"] = payload.Route
	}
	if payload.Method != "" {
		metadata["method"] = payload.Method
	}
	if payload.StatusCode != nil {
		metadata["statusCode"] = *payload.StatusCode
	}
	if payload.DurationMs != nil {
		metadata["durationMs"] = *payload.DurationMs
	}
	return metadata
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
	if _, err := time.Parse(time.RFC3339Nano, payload.Timestamp); err != nil {
		return errors.New("timestamp must be RFC3339")
	}
	return nil
}

func withDefaultLogTimestamp(payload logPayload) logPayload {
	if strings.TrimSpace(payload.Timestamp) == "" {
		payload.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
	}
	return payload
}

func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request completed", "method", r.Method, "path", r.URL.Path, "durationMs", time.Since(started).Milliseconds())
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, X-Request-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
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

func authErrorResponse(message string) map[string]interface{} {
	return map[string]interface{}{
		"success": false,
		"error":   message,
	}
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func degradedStatus(status string) string {
	if status == "ok" {
		return "healthy"
	}
	return "degraded"
}

func dependencyStatuses(checks map[string]checkResult, defaults map[string]string) map[string]string {
	out := make(map[string]string, len(checks)+len(defaults))
	for key, value := range defaults {
		out[key] = value
	}
	for key, value := range checks {
		if value.Status == "ok" {
			out[key] = "healthy"
		} else {
			out[key] = "degraded"
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
