import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  SERVICE_NAME: z.string().default("core-api"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url().default("postgresql://aegisops:aegisops@localhost:5432/aegisops"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  KAFKA_BROKERS: z.string().min(1).default("localhost:9094"),
  RABBITMQ_URL: z.string().url().default("amqp://aegisops:aegisops@localhost:5672"),
  JWT_SECRET: z.string().min(16).default("local-development-jwt-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30)
});

export const env = envSchema.parse(process.env);

export const kafkaBrokers = env.KAFKA_BROKERS.split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);
