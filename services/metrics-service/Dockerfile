FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/metrics-service ./cmd/metrics-service

FROM alpine:3.20
RUN adduser -D -H appuser
COPY --from=build /out/metrics-service /usr/local/bin/metrics-service
USER appuser
EXPOSE 5002
CMD ["metrics-service"]
