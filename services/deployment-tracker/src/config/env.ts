import { z } from "zod";

export const env = z
  .object({
    SERVICE_NAME: z.string().default("deployment-tracker"),
    PORT: z.coerce.number().default(4010),
    KAFKA_BROKERS: z.string().min(1).default("localhost:9094"),
    RABBITMQ_URL: z.string().url().optional(),
    REDIS_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url().default("postgresql://aegisops:aegisops@localhost:5432/aegisops")
  })
  .parse(process.env);

export const kafkaBrokers = env.KAFKA_BROKERS.split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);
