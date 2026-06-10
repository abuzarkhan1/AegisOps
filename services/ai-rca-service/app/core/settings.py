import os


class Settings:
    service_name = os.getenv("SERVICE_NAME", "ai-rca-service")
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://aegisops:aegisops@localhost:5672")


settings = Settings()
