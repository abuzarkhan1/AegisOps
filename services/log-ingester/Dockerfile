FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/log-ingester ./cmd/log-ingester

FROM alpine:3.20
RUN adduser -D -H appuser
COPY --from=build /out/log-ingester /usr/local/bin/log-ingester
USER appuser
EXPOSE 5001
CMD ["log-ingester"]
