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
	"sync"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/segmentio/kafka-go"
)

type metricPayload struct {
	OrganizationID string            `json:"organizationId,omitempty"`
	ProjectID      string            `json:"projectId,omitempty"`
	ProjectKey     string            `json:"projectKey,omitempty"`
	ServiceName    string            `json:"serviceName"`
	ServiceID      string            `json:"serviceId,omitempty"`
	Environment    string            `json:"environment"`
	MetricName     string            `json:"metricName"`
	Value          float64           `json:"value"`
	Timestamp      string            `json:"timestamp"`
	Labels         map[string]string `json:"labels,omitempty"`
}

type metricSnapshotPayload struct {
	OrganizationID string             `json:"organizationId,omitempty"`
	ProjectID      string             `json:"projectId,omitempty"`
	ProjectKey     string             `json:"projectKey,omitempty"`
	ServiceName    string             `json:"serviceName"`
	ServiceID      string             `json:"serviceId,omitempty"`
	Environment    string             `json:"environment"`
	Timestamp      string             `json:"timestamp"`
	Metrics        map[string]float64 `json:"metrics"`
	Labels         map[string]string  `json:"labels,omitempty"`
}

type metricBatchItem struct {
	MetricName string            `json:"metricName"`
	Value      float64           `json:"value"`
	Timestamp  string            `json:"timestamp"`
	Labels     map[string]string `json:"labels,omitempty"`
}

type metricBatchPayload struct {
	OrganizationID string            `json:"organizationId,omitempty"`
	ProjectID      string            `json:"projectId,omitempty"`
	ProjectKey     string            `json:"projectKey,omitempty"`
	ServiceName    string            `json:"serviceName"`
	ServiceID      string            `json:"serviceId,omitempty"`
	Environment    string            `json:"environment"`
	Metrics        []metricBatchItem `json:"metrics"`
}

type healthSnapshotPayload struct {
	OrganizationID string                 `json:"organizationId,omitempty"`
	ProjectID      string                 `json:"projectId,omitempty"`
	ServiceName    string                 `json:"serviceName"`
	ServiceID      string                 `json:"serviceId,omitempty"`
	Environment    string                 `json:"environment"`
	Status         string                 `json:"status"`
	Timestamp      string                 `json:"timestamp"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

type serviceMetricSummary struct {
	ServiceID     string             `json:"serviceId"`
	ServiceName   string             `json:"serviceName"`
	Environment   string             `json:"environment"`
	LastTimestamp string             `json:"lastTimestamp"`
	Metrics       map[string]float64 `json:"metrics"`
	HealthStatus  string             `json:"healthStatus"`
	Samples       int                `json:"samples"`
}

type summaryStore struct {
	mu       sync.RWMutex
	services map[string]serviceMetricSummary
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

var customMetricsReceived = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "aegisops_custom_metrics_received_total",
		Help: "Total custom metric payloads received",
	},
	[]string{"service_name", "environment", "metric_name"},
)

func main() {
	serviceName := getenv("SERVICE_NAME", "metrics-service")
	port := getenv("PORT", "5002")
	brokers := splitCSV(getenv("KAFKA_BROKERS", "localhost:9094"))
	redisAddr := getenv("REDIS_ADDR", "localhost:6379")
	coreAPIURL := strings.TrimRight(getenv("CORE_API_URL", "http://localhost:4000"), "/")

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	prometheus.MustRegister(customMetricsReceived)

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "metrics.received",
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireOne,
		Async:        false,
	}
	defer writer.Close()
	validator := newAPIKeyValidator(redisAddr, coreAPIURL)
	store := &summaryStore{services: make(map[string]serviceMetricSummary)}

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", healthHandler(serviceName, brokers, redisAddr, coreAPIURL))
	mux.HandleFunc("/metrics/custom", metricsHandler(logger, writer, validator))
	mux.HandleFunc("/metrics-api/metrics/custom", metricsHandler(logger, writer, validator))
	mux.HandleFunc("/metrics/batch", batchMetricsHandler(logger, writer, validator))
	mux.HandleFunc("/metrics-api/metrics/batch", batchMetricsHandler(logger, writer, validator))
	mux.HandleFunc("/ingest", metricsIngestHandler(logger, writer, validator, store))
	mux.HandleFunc("/metrics-api/ingest", metricsIngestHandler(logger, writer, validator, store))
	mux.HandleFunc("/health-snapshot", healthSnapshotHandler(logger, writer, validator, store))
	mux.HandleFunc("/metrics-api/health-snapshot", healthSnapshotHandler(logger, writer, validator, store))
	mux.HandleFunc("/services/", serviceSummaryHandler(store))
	mux.HandleFunc("/metrics-api/services/", serviceSummaryHandler(store))

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           requestLogger(logger, withCORS(mux)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("Metrics service ready", "port", port, "kafkaBrokers", brokers, "topic", "metrics.received", "coreAPIURL", coreAPIURL)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Metrics service stopped unexpectedly", "error", err)
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

func metricsHandler(logger *slog.Logger, writer *kafka.Writer, validator *apiKeyValidator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if !authorizeRequest(w, r, logger, validator) {
			return
		}
		apiKey := apiKeyFromRequest(r)

		var payload metricPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		payload = withDefaultMetricTimestamp(payload)

		if err := validateMetricPayload(payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		keyContext, contextErr := validator.resolveContext(r.Context(), apiKey, payload.ProjectKey, payload.ServiceName)
		if contextErr != nil {
			logger.Error("API key context lookup failed", "error", contextErr)
			writeJSON(w, http.StatusUnauthorized, authErrorResponse("Invalid or revoked API key"))
			return
		}
		organizationID := firstNonEmpty(payload.OrganizationID, keyContext.OrganizationID)
		projectID := firstNonEmpty(payload.ProjectID, keyContext.ProjectID)
		projectKey := firstNonEmpty(payload.ProjectKey, keyContext.ProjectKey)
		serviceID := firstNonEmpty(payload.ServiceID, keyContext.ServiceID)
		payload.Environment = firstNonEmpty(payload.Environment, keyContext.Environment, "production")

		body, err := json.Marshal(map[string]interface{}{
			"eventType":      "metrics.received",
			"organizationId": organizationID,
			"projectId":      projectID,
			"projectKey":     projectKey,
			"serviceName":    payload.ServiceName,
			"serviceId":      serviceID,
			"environment":    payload.Environment,
			"metricName":     payload.MetricName,
			"value":          payload.Value,
			"timestamp":      payload.Timestamp,
			"labels":         payload.Labels,
			"receivedAt":     time.Now().UTC().Format(time.RFC3339Nano),
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to encode Kafka message"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := writer.WriteMessages(ctx, kafka.Message{
			Key:   []byte(payload.ServiceName + ":" + payload.MetricName),
			Value: body,
		}); err != nil {
			logger.Error("Failed to publish metric payload", "error", err, "topic", "metrics.received")
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to publish metric payload"})
			return
		}

		customMetricsReceived.WithLabelValues(payload.ServiceName, payload.Environment, payload.MetricName).Inc()
		if contextErr == nil {
			snapshot := metricSnapshotPayload{
				OrganizationID: organizationID,
				ProjectID:      projectID,
				ProjectKey:     projectKey,
				ServiceName:    payload.ServiceName,
				ServiceID:      serviceID,
				Environment:    payload.Environment,
				Timestamp:      payload.Timestamp,
				Metrics:        map[string]float64{payload.MetricName: payload.Value},
				Labels:         payload.Labels,
			}
			if err := evaluateAlertRules(r.Context(), validator.coreAPIURL, snapshot, keyContext); err != nil {
				logger.Error("Alert rule evaluation failed", "error", err, "serviceName", payload.ServiceName, "metricName", payload.MetricName)
			}
		}
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "accepted", "topic": "metrics.received"})
	}
}

func batchMetricsHandler(logger *slog.Logger, writer *kafka.Writer, validator *apiKeyValidator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if !authorizeRequest(w, r, logger, validator) {
			return
		}

		apiKey := apiKeyFromRequest(r)
		limited, err := isRateLimited(r.Context(), validator.redisAddr, "metrics-batch", apiKey, 300)
		if err != nil {
			logger.Error("Rate limit check failed", "error", err)
		} else if limited {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
			return
		}

		var payload metricBatchPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		payload = withDefaultMetricBatchTimestamps(payload)
		if err := validateMetricBatch(payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		keyContext, contextErr := validator.resolveContext(r.Context(), apiKey, payload.ProjectKey, payload.ServiceName)
		if contextErr != nil {
			logger.Error("API key context lookup failed", "error", contextErr)
			writeJSON(w, http.StatusUnauthorized, authErrorResponse("Invalid or revoked API key"))
			return
		}
		payload.OrganizationID = firstNonEmpty(payload.OrganizationID, keyContext.OrganizationID)
		payload.ProjectID = firstNonEmpty(payload.ProjectID, keyContext.ProjectID)
		payload.ProjectKey = firstNonEmpty(payload.ProjectKey, keyContext.ProjectKey)
		payload.ServiceID = firstNonEmpty(payload.ServiceID, keyContext.ServiceID)
		payload.Environment = firstNonEmpty(payload.Environment, keyContext.Environment, "production")

		messages := make([]kafka.Message, 0, len(payload.Metrics))
		metricsForAlert := make(map[string]float64, len(payload.Metrics))
		for _, item := range payload.Metrics {
			metricsForAlert[item.MetricName] = item.Value
			body, err := json.Marshal(map[string]interface{}{
				"eventType":      "metrics.received",
				"organizationId": payload.OrganizationID,
				"projectId":      payload.ProjectID,
				"projectKey":     payload.ProjectKey,
				"serviceName":    payload.ServiceName,
				"serviceId":      payload.ServiceID,
				"environment":    payload.Environment,
				"metricName":     item.MetricName,
				"value":          item.Value,
				"timestamp":      item.Timestamp,
				"labels":         item.Labels,
				"receivedAt":     time.Now().UTC().Format(time.RFC3339Nano),
			})
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to encode Kafka message"})
				return
			}
			messages = append(messages, kafka.Message{
				Key:   []byte(payload.ServiceName + ":" + item.MetricName),
				Value: body,
			})
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		if err := writer.WriteMessages(ctx, messages...); err != nil {
			logger.Error("Failed to publish metrics batch", "error", err, "topic", "metrics.received", "count", len(messages))
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to publish metrics batch"})
			return
		}

		for _, item := range payload.Metrics {
			customMetricsReceived.WithLabelValues(payload.ServiceName, payload.Environment, item.MetricName).Inc()
		}
		if contextErr == nil {
			snapshot := metricSnapshotPayload{
				OrganizationID: payload.OrganizationID,
				ProjectID:      payload.ProjectID,
				ProjectKey:     payload.ProjectKey,
				ServiceName:    payload.ServiceName,
				ServiceID:      payload.ServiceID,
				Environment:    payload.Environment,
				Timestamp:      payload.Metrics[len(payload.Metrics)-1].Timestamp,
				Metrics:        metricsForAlert,
			}
			if err := evaluateAlertRules(r.Context(), validator.coreAPIURL, snapshot, keyContext); err != nil {
				logger.Error("Alert rule evaluation failed", "error", err, "serviceName", payload.ServiceName)
			}
		}
		writeJSON(w, http.StatusAccepted, map[string]interface{}{"status": "accepted", "topic": "metrics.received", "count": len(payload.Metrics)})
	}
}

func metricsIngestHandler(logger *slog.Logger, writer *kafka.Writer, validator *apiKeyValidator, store *summaryStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if !authorizeRequest(w, r, logger, validator) {
			return
		}

		apiKey := apiKeyFromRequest(r)
		limited, err := isRateLimited(r.Context(), validator.redisAddr, "metrics-ingest", apiKey, 500)
		if err != nil {
			logger.Error("Rate limit check failed", "error", err)
		} else if limited {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
			return
		}

		var payload metricSnapshotPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		payload = withDefaultMetricSnapshotTimestamp(payload)
		if err := validateMetricSnapshot(payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		keyContext, contextErr := validator.resolveContext(r.Context(), apiKey, payload.ProjectKey, payload.ServiceName)
		if contextErr != nil {
			logger.Error("API key context lookup failed", "error", contextErr)
			writeJSON(w, http.StatusUnauthorized, authErrorResponse("Invalid or revoked API key"))
			return
		}
		payload.Environment = firstNonEmpty(payload.Environment, keyContext.Environment, "production")
		payload.OrganizationID = firstNonEmpty(payload.OrganizationID, keyContext.OrganizationID)
		payload.ProjectID = firstNonEmpty(payload.ProjectID, keyContext.ProjectID)
		payload.ProjectKey = firstNonEmpty(payload.ProjectKey, keyContext.ProjectKey)
		payload.ServiceID = firstNonEmpty(payload.ServiceID, keyContext.ServiceID)

		body, err := json.Marshal(map[string]interface{}{
			"eventType":      "metrics.received",
			"organizationId": payload.OrganizationID,
			"projectId":      payload.ProjectID,
			"projectKey":     payload.ProjectKey,
			"serviceName":    payload.ServiceName,
			"serviceId":      payload.ServiceID,
			"environment":    payload.Environment,
			"timestamp":      payload.Timestamp,
			"metrics":        payload.Metrics,
			"labels":         payload.Labels,
			"receivedAt":     time.Now().UTC().Format(time.RFC3339Nano),
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to encode Kafka message"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := writer.WriteMessages(ctx, kafka.Message{
			Key:   []byte(serviceKey(payload.ServiceID, payload.ServiceName)),
			Value: body,
		}); err != nil {
			logger.Error("Failed to publish metrics snapshot", "error", err, "topic", "metrics.received")
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to publish metrics snapshot"})
			return
		}

		for name := range payload.Metrics {
			customMetricsReceived.WithLabelValues(payload.ServiceName, payload.Environment, name).Inc()
		}
		store.recordMetrics(payload)
		if contextErr == nil {
			if err := evaluateAlertRules(r.Context(), validator.coreAPIURL, payload, keyContext); err != nil {
				logger.Error("Alert rule evaluation failed", "error", err, "serviceName", payload.ServiceName)
			}
		}
		writeJSON(w, http.StatusAccepted, map[string]interface{}{"status": "accepted", "topic": "metrics.received"})
	}
}

func healthSnapshotHandler(logger *slog.Logger, writer *kafka.Writer, validator *apiKeyValidator, store *summaryStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if !authorizeRequest(w, r, logger, validator) {
			return
		}

		var payload healthSnapshotPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		payload = withDefaultHealthTimestamp(payload)
		if err := validateHealthSnapshot(payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		apiKey := apiKeyFromRequest(r)
		keyContext, contextErr := validator.resolveContext(r.Context(), apiKey, payload.ProjectID, payload.ServiceName)
		if contextErr != nil {
			logger.Error("API key context lookup failed", "error", contextErr)
			writeJSON(w, http.StatusUnauthorized, authErrorResponse("Invalid or revoked API key"))
			return
		}
		payload.Environment = firstNonEmpty(payload.Environment, keyContext.Environment, "production")
		payload.OrganizationID = firstNonEmpty(payload.OrganizationID, keyContext.OrganizationID)
		payload.ProjectID = firstNonEmpty(payload.ProjectID, keyContext.ProjectID)
		payload.ServiceID = firstNonEmpty(payload.ServiceID, keyContext.ServiceID)

		body, err := json.Marshal(map[string]interface{}{
			"eventType":      "service.health.changed",
			"organizationId": payload.OrganizationID,
			"projectId":      payload.ProjectID,
			"serviceName":    payload.ServiceName,
			"serviceId":      payload.ServiceID,
			"environment":    payload.Environment,
			"status":         payload.Status,
			"timestamp":      payload.Timestamp,
			"metadata":       payload.Metadata,
			"receivedAt":     time.Now().UTC().Format(time.RFC3339Nano),
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to encode Kafka message"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := writer.WriteMessages(ctx, kafka.Message{
			Key:   []byte(serviceKey(payload.ServiceID, payload.ServiceName)),
			Value: body,
		}); err != nil {
			logger.Error("Failed to publish health snapshot", "error", err, "topic", "metrics.received")
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to publish health snapshot"})
			return
		}

		store.recordHealth(payload)
		if contextErr == nil {
			if err := evaluateHealthAlertRules(r.Context(), validator.coreAPIURL, payload, keyContext); err != nil {
				logger.Error("Health alert rule evaluation failed", "error", err, "serviceName", payload.ServiceName)
			}
		}
		writeJSON(w, http.StatusAccepted, map[string]interface{}{"status": "accepted", "topic": "metrics.received"})
	}
}

func serviceSummaryHandler(store *summaryStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		serviceID, ok := serviceIDFromSummaryPath(r.URL.Path)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "summary route not found"})
			return
		}
		summary, ok := store.summary(serviceID)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "service summary not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"summary": summary})
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

func healthHandler(serviceName string, brokers []string, redisAddr string, coreAPIURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		checks := map[string]checkResult{
			"kafka":    checkTCP(firstOrDefault(brokers, "localhost:9094")),
			"redis":    checkTCP(redisAddr),
			"core_api": checkHTTP(coreAPIURL + "/health"),
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
			"topic":        "metrics.received",
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

func evaluateAlertRules(ctx context.Context, coreAPIURL string, payload metricSnapshotPayload, keyContext apiKeyContext) error {
	organizationID := firstNonEmpty(payload.OrganizationID, keyContext.OrganizationID)
	if organizationID == "" {
		return nil
	}
	serviceID := firstNonEmpty(payload.ServiceID, keyContext.ServiceID)
	projectID := firstNonEmpty(payload.ProjectID, keyContext.ProjectID)
	requestBody := map[string]interface{}{
		"organizationId": organizationID,
		"projectId":      projectID,
		"serviceId":      serviceID,
		"serviceName":    payload.ServiceName,
		"environment":    payload.Environment,
		"timestamp":      payload.Timestamp,
		"metrics":        payload.Metrics,
	}
	return postAlertEvaluation(ctx, coreAPIURL, requestBody)
}

func evaluateHealthAlertRules(ctx context.Context, coreAPIURL string, payload healthSnapshotPayload, keyContext apiKeyContext) error {
	organizationID := firstNonEmpty(payload.OrganizationID, keyContext.OrganizationID)
	if organizationID == "" {
		return nil
	}
	serviceID := firstNonEmpty(payload.ServiceID, keyContext.ServiceID)
	projectID := firstNonEmpty(payload.ProjectID, keyContext.ProjectID)
	requestBody := map[string]interface{}{
		"organizationId": organizationID,
		"projectId":      projectID,
		"serviceId":      serviceID,
		"serviceName":    payload.ServiceName,
		"environment":    payload.Environment,
		"timestamp":      payload.Timestamp,
		"healthStatus":   payload.Status,
	}
	return postAlertEvaluation(ctx, coreAPIURL, requestBody)
}

func postAlertEvaluation(ctx context.Context, coreAPIURL string, requestBody map[string]interface{}) error {
	body, err := json.Marshal(requestBody)
	if err != nil {
		return err
	}
	evalCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(evalCtx, http.MethodPost, strings.TrimRight(coreAPIURL, "/")+"/api/alert-rules/evaluate", bytes.NewReader(body))
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
		return fmt.Errorf("core api alert evaluation returned %d: %s", resp.StatusCode, strings.TrimSpace(string(responseBody)))
	}
	return nil
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

func validateMetricPayload(payload metricPayload) error {
	if strings.TrimSpace(payload.ServiceName) == "" {
		return errors.New("serviceName is required")
	}
	if strings.TrimSpace(payload.MetricName) == "" {
		return errors.New("metricName is required")
	}
	if _, err := time.Parse(time.RFC3339Nano, payload.Timestamp); err != nil {
		return errors.New("timestamp must be RFC3339")
	}
	return nil
}

func validateMetricSnapshot(payload metricSnapshotPayload) error {
	if strings.TrimSpace(payload.ServiceName) == "" {
		return errors.New("serviceName is required")
	}
	if _, err := time.Parse(time.RFC3339Nano, payload.Timestamp); err != nil {
		return errors.New("timestamp must be RFC3339")
	}
	if len(payload.Metrics) == 0 {
		return errors.New("metrics must contain at least one value")
	}
	return nil
}

func validateMetricBatch(payload metricBatchPayload) error {
	if strings.TrimSpace(payload.ServiceName) == "" {
		return errors.New("serviceName is required")
	}
	if len(payload.Metrics) == 0 {
		return errors.New("metrics must contain at least one item")
	}
	if len(payload.Metrics) > 500 {
		return errors.New("metrics batch cannot exceed 500 items")
	}
	for index, item := range payload.Metrics {
		if strings.TrimSpace(item.MetricName) == "" {
			return fmt.Errorf("metrics[%d].metricName is required", index)
		}
		if _, err := time.Parse(time.RFC3339Nano, item.Timestamp); err != nil {
			return fmt.Errorf("metrics[%d].timestamp must be RFC3339", index)
		}
	}
	return nil
}

func validateHealthSnapshot(payload healthSnapshotPayload) error {
	if strings.TrimSpace(payload.ServiceName) == "" {
		return errors.New("serviceName is required")
	}
	if strings.TrimSpace(payload.Status) == "" {
		return errors.New("status is required")
	}
	if _, err := time.Parse(time.RFC3339Nano, payload.Timestamp); err != nil {
		return errors.New("timestamp must be RFC3339")
	}
	return nil
}

func defaultTimestamp() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func withDefaultMetricTimestamp(payload metricPayload) metricPayload {
	if strings.TrimSpace(payload.Timestamp) == "" {
		payload.Timestamp = defaultTimestamp()
	}
	return payload
}

func withDefaultMetricSnapshotTimestamp(payload metricSnapshotPayload) metricSnapshotPayload {
	if strings.TrimSpace(payload.Timestamp) == "" {
		payload.Timestamp = defaultTimestamp()
	}
	return payload
}

func withDefaultMetricBatchTimestamps(payload metricBatchPayload) metricBatchPayload {
	for index, item := range payload.Metrics {
		if strings.TrimSpace(item.Timestamp) == "" {
			payload.Metrics[index].Timestamp = defaultTimestamp()
		}
	}
	return payload
}

func withDefaultHealthTimestamp(payload healthSnapshotPayload) healthSnapshotPayload {
	if strings.TrimSpace(payload.Timestamp) == "" {
		payload.Timestamp = defaultTimestamp()
	}
	return payload
}

func (store *summaryStore) recordMetrics(payload metricSnapshotPayload) {
	key := serviceKey(payload.ServiceID, payload.ServiceName)
	store.mu.Lock()
	defer store.mu.Unlock()

	current := store.services[key]
	current.ServiceID = key
	current.ServiceName = payload.ServiceName
	current.Environment = payload.Environment
	current.LastTimestamp = payload.Timestamp
	current.Metrics = copyMetrics(payload.Metrics)
	if current.HealthStatus == "" {
		current.HealthStatus = "unknown"
	}
	current.Samples++
	store.services[key] = current
}

func (store *summaryStore) recordHealth(payload healthSnapshotPayload) {
	key := serviceKey(payload.ServiceID, payload.ServiceName)
	store.mu.Lock()
	defer store.mu.Unlock()

	current := store.services[key]
	current.ServiceID = key
	current.ServiceName = payload.ServiceName
	current.Environment = payload.Environment
	current.LastTimestamp = payload.Timestamp
	current.HealthStatus = payload.Status
	if current.Metrics == nil {
		current.Metrics = map[string]float64{}
	}
	current.Samples++
	store.services[key] = current
}

func (store *summaryStore) summary(serviceID string) (serviceMetricSummary, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	summary, ok := store.services[serviceID]
	if !ok {
		return serviceMetricSummary{}, false
	}
	summary.Metrics = copyMetrics(summary.Metrics)
	return summary, true
}

func copyMetrics(source map[string]float64) map[string]float64 {
	out := make(map[string]float64, len(source))
	for key, value := range source {
		out[key] = value
	}
	return out
}

func serviceKey(serviceID string, serviceName string) string {
	if strings.TrimSpace(serviceID) != "" {
		return strings.TrimSpace(serviceID)
	}
	return strings.TrimSpace(serviceName)
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

func serviceIDFromSummaryPath(path string) (string, bool) {
	trimmed := strings.Trim(path, "/")
	parts := strings.Split(trimmed, "/")
	if len(parts) == 3 && parts[0] == "services" && parts[2] == "summary" {
		return parts[1], true
	}
	if len(parts) == 4 && parts[0] == "metrics-api" && parts[1] == "services" && parts[3] == "summary" {
		return parts[2], true
	}
	return "", false
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

func firstOrDefault(values []string, fallback string) string {
	if len(values) == 0 {
		return fallback
	}
	return values[0]
}
