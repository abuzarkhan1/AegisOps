package aegisops

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Enabled              bool
	APIURL               string
	APIKey               string
	ProjectKey           string
	ServiceName          string
	Environment          string
	CaptureRequestBody   bool
	CaptureResponseBody  bool
	CaptureHeaders       bool
	IgnoredRoutes        []string
	SlowRequestThreshold time.Duration
	FlushInterval        time.Duration
	SlowRequestThresholdMS int
	FlushIntervalMS        int
	BatchSize            int
	Debug                bool
	Timeout              time.Duration
}

func DefaultConfig() Config {
	return Config{
		Enabled:              true,
		APIURL:               "http://localhost:8080",
		Environment:          "development",
		IgnoredRoutes:        []string{"/health", "/metrics", "/favicon.ico"},
		SlowRequestThreshold: time.Second,
		FlushInterval:        5 * time.Second,
		BatchSize:            20,
		Timeout:              1500 * time.Millisecond,
		CaptureRequestBody:   false,
		CaptureResponseBody:  false,
		CaptureHeaders:       false,
		Debug:                false,
	}
}

func ConfigFromEnv() Config {
	cfg := DefaultConfig()
	cfg.Enabled = envBool("AEGISOPS_ENABLED", true)
	cfg.APIURL = envString("AEGISOPS_API_URL", cfg.APIURL)
	cfg.APIKey = strings.TrimSpace(os.Getenv("AEGISOPS_API_KEY"))
	cfg.ProjectKey = strings.TrimSpace(os.Getenv("AEGISOPS_PROJECT_KEY"))
	cfg.ServiceName = strings.TrimSpace(os.Getenv("AEGISOPS_SERVICE_NAME"))
	cfg.Environment = envString("AEGISOPS_ENVIRONMENT", envString("ENVIRONMENT", cfg.Environment))
	cfg.SlowRequestThresholdMS = envInt("AEGISOPS_SLOW_REQUEST_THRESHOLD_MS", 0)
	cfg.FlushIntervalMS = envInt("AEGISOPS_FLUSH_INTERVAL_MS", 0)
	cfg.BatchSize = envInt("AEGISOPS_BATCH_SIZE", cfg.BatchSize)
	cfg.Debug = envBool("AEGISOPS_DEBUG", cfg.Debug)
	return cfg
}

func normalizeConfig(cfg Config) Config {
	defaults := DefaultConfig()
	if cfg.APIURL == "" {
		cfg.APIURL = defaults.APIURL
	}
	cfg.APIURL = strings.TrimRight(cfg.APIURL, "/")
	if cfg.Environment == "" {
		cfg.Environment = defaults.Environment
	}
	if cfg.IgnoredRoutes == nil {
		cfg.IgnoredRoutes = defaults.IgnoredRoutes
	}
	if cfg.SlowRequestThreshold <= 0 {
		if cfg.SlowRequestThresholdMS > 0 {
			cfg.SlowRequestThreshold = time.Duration(cfg.SlowRequestThresholdMS) * time.Millisecond
		} else {
			cfg.SlowRequestThreshold = defaults.SlowRequestThreshold
		}
	}
	if cfg.FlushInterval < 0 {
		cfg.FlushInterval = 0
	}
	if cfg.FlushInterval == 0 {
		if cfg.FlushIntervalMS > 0 {
			cfg.FlushInterval = time.Duration(cfg.FlushIntervalMS) * time.Millisecond
		} else {
			cfg.FlushInterval = defaults.FlushInterval
		}
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = defaults.BatchSize
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaults.Timeout
	}
	return cfg
}

func envString(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	if parsed, err := strconv.ParseBool(value); err == nil {
		return parsed
	}
	return !map[string]bool{"0": true, "no": true, "off": true}[value]
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
