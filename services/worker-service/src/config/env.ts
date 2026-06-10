import { z } from "zod";

export const env = z
  .object({
    SERVICE_NAME: z.string().default("worker-service"),
    PORT: z.coerce.number().default(4020),
    DATABASE_URL: z.string().url().default("postgresql://aegisops:aegisops@localhost:5432/aegisops"),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    KAFKA_BROKERS: z.string().min(1).default("localhost:9094"),
    KAFKA_CONSUMER_GROUP: z.string().default("aegisops-worker-service"),
    RABBITMQ_URL: z.string().url().default("amqp://aegisops:aegisops@localhost:5672"),
    CORE_API_URL: z.string().url().default("http://localhost:4000"),
    WORKER_CONSUMERS_ENABLED: z
      .string()
      .default("true")
      .transform((value) => value !== "false"),
    LOG_RETENTION_DAYS: z.coerce.number().default(30),
    RAW_METRIC_RETENTION_DAYS: z.coerce.number().default(14),
    AGGREGATE_METRIC_RETENTION_DAYS: z.coerce.number().default(180),
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().default(365),
    INCIDENT_EVENT_RETENTION_DAYS: z.coerce.number().default(365)
  })
  .parse(process.env);

export const kafkaBrokers = env.KAFKA_BROKERS.split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

