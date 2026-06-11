package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	aegisops "github.com/aegisops/aegisops-go"
)

type order struct {
	ID       string `json:"id"`
	SKU      string `json:"sku"`
	Quantity int    `json:"quantity"`
	Status   string `json:"status"`
}

var (
	ordersMu sync.Mutex
	orders   = []order{
		{ID: "ord_1001", SKU: "starter-plan", Quantity: 1, Status: "paid"},
		{ID: "ord_1002", SKU: "ops-seat", Quantity: 3, Status: "processing"},
	}
)

func main() {
	client := aegisops.NewClientFromEnv()
	defer client.Shutdown(context.Background())

	mux := http.NewServeMux()
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/api/orders", ordersHandler(client))
	mux.HandleFunc("/api/slow", slow)
	mux.HandleFunc("/api/error", boom)
	mux.HandleFunc("/api/random", random)

	port := env("PORT", "7003")
	fmt.Printf("AegisOps Go example listening on http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, client.Middleware(mux)); err != nil {
		panic(err)
	}
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "service": "go-http-service"})
}

func ordersHandler(client *aegisops.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			ordersMu.Lock()
			defer ordersMu.Unlock()
			writeJSON(w, http.StatusOK, map[string]interface{}{"orders": orders})
		case http.MethodPost:
			var input struct {
				SKU      string `json:"sku"`
				Quantity int    `json:"quantity"`
			}
			_ = json.NewDecoder(r.Body).Decode(&input)
			if input.SKU == "" {
				input.SKU = "unknown"
			}
			if input.Quantity <= 0 {
				input.Quantity = 1
			}
			item := order{ID: "ord_" + strconv.FormatInt(time.Now().UnixMilli(), 10), SKU: input.SKU, Quantity: input.Quantity, Status: "created"}
			ordersMu.Lock()
			orders = append(orders, item)
			ordersMu.Unlock()
			client.SendLog(r.Context(), aegisops.Log{
				Level:      "info",
				Message:    "order created",
				Route:      "/api/orders",
				Method:     "POST",
				StatusCode: http.StatusCreated,
				Metadata:   map[string]interface{}{"orderId": item.ID, "sku": item.SKU},
			})
			writeJSON(w, http.StatusCreated, map[string]interface{}{"order": item})
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func slow(w http.ResponseWriter, _ *http.Request) {
	time.Sleep(1500 * time.Millisecond)
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "delayedMs": 1500})
}

func boom(_ http.ResponseWriter, _ *http.Request) {
	panic("Intentional Go example error")
}

func random(w http.ResponseWriter, _ *http.Request) {
	value := rand.Float64()
	if value < 0.2 {
		http.Error(w, "random validation failure", http.StatusBadRequest)
		return
	}
	if value < 0.35 {
		panic("Random dependency failure")
	}
	if value < 0.55 {
		time.Sleep(1600 * time.Millisecond)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "value": value})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func env(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
