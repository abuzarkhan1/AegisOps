package aegisops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

type Log struct {
	Level      string                 `json:"level,omitempty"`
	Message    string                 `json:"message"`
	TraceID    string                 `json:"traceId,omitempty"`
	RequestID  string                 `json:"requestId,omitempty"`
	Route      string                 `json:"route,omitempty"`
	Method     string                 `json:"method,omitempty"`
	StatusCode int                    `json:"statusCode,omitempty"`
	DurationMS float64                `json:"durationMs,omitempty"`
	Timestamp  string                 `json:"timestamp,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type Metric struct {
	MetricName string            `json:"metricName"`
	Value      float64           `json:"value"`
	Labels     map[string]string `json:"labels,omitempty"`
	Timestamp  string            `json:"timestamp,omitempty"`
}

type Client struct {
	cfg        Config
	httpClient *http.Client
	mu         sync.Mutex
	metrics    []Metric
	stop       chan struct{}
	stopped    chan struct{}
}

func NewClient(cfg Config) *Client {
	cfg = normalizeConfig(cfg)
	client := &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: cfg.Timeout},
		stop:       make(chan struct{}),
		stopped:    make(chan struct{}),
	}
	if cfg.Enabled && cfg.FlushInterval > 0 {
		go client.flushLoop()
	} else {
		close(client.stopped)
	}
	return client
}

func NewClientFromEnv() *Client {
	return NewClient(ConfigFromEnv())
}

var (
	defaultClient     *Client
	defaultClientOnce sync.Once
)

func envClient() *Client {
	defaultClientOnce.Do(func() {
		defaultClient = NewClientFromEnv()
	})
	return defaultClient
}

func SendLog(ctx context.Context, item Log) {
	envClient().SendLog(ctx, item)
}

func SendMetric(ctx context.Context, item Metric) {
	envClient().SendMetric(ctx, item)
}

func SendBatchMetrics(ctx context.Context, items []Metric) {
	envClient().SendBatchMetrics(ctx, items)
}

func (client *Client) CanSend() bool {
	return client.cfg.Enabled && client.cfg.APIKey != "" && client.cfg.ProjectKey != "" && client.cfg.ServiceName != ""
}

func (client *Client) SendLog(ctx context.Context, item Log) {
	if !client.CanSend() {
		client.debug("log dropped because SDK is disabled or config is incomplete")
		return
	}
	if item.Level == "" {
		item.Level = "info"
	}
	if item.Timestamp == "" {
		item.Timestamp = utcNow()
	}
	payload := map[string]interface{}{
		"projectKey":  client.cfg.ProjectKey,
		"serviceName": client.cfg.ServiceName,
		"environment": client.cfg.Environment,
		"level":       item.Level,
		"message":     item.Message,
		"traceId":     item.TraceID,
		"requestId":   item.RequestID,
		"route":       item.Route,
		"method":      item.Method,
		"statusCode":  item.StatusCode,
		"durationMs":  item.DurationMS,
		"timestamp":   item.Timestamp,
		"metadata":    item.Metadata,
	}
	client.postJSON(ctx, "/ingest/logs", payload)
}

func (client *Client) SendMetric(ctx context.Context, item Metric) {
	client.SendBatchMetrics(ctx, []Metric{item})
}

func (client *Client) SendBatchMetrics(ctx context.Context, items []Metric) {
	if !client.CanSend() {
		client.debug("metrics dropped because SDK is disabled or config is incomplete")
		return
	}
	if len(items) == 0 {
		return
	}
	now := utcNow()
	for index := range items {
		if items[index].Timestamp == "" {
			items[index].Timestamp = now
		}
		if items[index].Labels == nil {
			items[index].Labels = map[string]string{}
		}
	}
	client.mu.Lock()
	client.metrics = append(client.metrics, items...)
	shouldFlush := len(client.metrics) >= client.cfg.BatchSize
	client.mu.Unlock()
	if shouldFlush {
		client.Flush(ctx)
	}
}

func (client *Client) Flush(ctx context.Context) {
	if !client.CanSend() {
		return
	}
	for {
		client.mu.Lock()
		if len(client.metrics) == 0 {
			client.mu.Unlock()
			return
		}
		count := client.cfg.BatchSize
		if len(client.metrics) < count {
			count = len(client.metrics)
		}
		batch := append([]Metric(nil), client.metrics[:count]...)
		client.metrics = client.metrics[count:]
		client.mu.Unlock()

		client.postJSON(ctx, "/metrics-api/metrics/batch", map[string]interface{}{
			"projectKey":  client.cfg.ProjectKey,
			"serviceName": client.cfg.ServiceName,
			"environment": client.cfg.Environment,
			"metrics":     batch,
		})
	}
}

func (client *Client) Shutdown(ctx context.Context) {
	select {
	case <-client.stop:
	default:
		close(client.stop)
	}
	select {
	case <-client.stopped:
	case <-time.After(time.Second):
	}
	client.Flush(ctx)
}

func (client *Client) flushLoop() {
	defer close(client.stopped)
	ticker := time.NewTicker(client.cfg.FlushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			client.Flush(context.Background())
		case <-client.stop:
			return
		}
	}
}

func (client *Client) postJSON(ctx context.Context, path string, payload interface{}) {
	body, err := json.Marshal(payload)
	if err != nil {
		client.debug("failed to encode telemetry payload: %v", err)
		return
	}
	for attempt := 1; attempt <= 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, client.cfg.APIURL+path, bytes.NewReader(body))
		if err != nil {
			client.debug("failed to create telemetry request: %v", err)
			return
		}
		req.Header.Set("Authorization", "Bearer "+client.cfg.APIKey)
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.httpClient.Do(req)
		if err == nil && resp != nil {
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return
			}
			err = fmt.Errorf("HTTP %d", resp.StatusCode)
		}
		if attempt == 3 {
			client.debug("dropping telemetry after %d failed attempts to %s: %v", attempt, path, err)
			return
		}
		time.Sleep(time.Duration(100*(1<<(attempt-1))) * time.Millisecond)
	}
}

func (client *Client) debug(format string, args ...interface{}) {
	if client.cfg.Debug {
		log.Printf("[aegisops] "+format, args...)
	}
}

func utcNow() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}
