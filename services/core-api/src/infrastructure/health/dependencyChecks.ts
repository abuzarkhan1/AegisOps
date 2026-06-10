import * as amqp from "amqplib";
import Redis from "ioredis";
import { Kafka } from "kafkajs";
import pg from "pg";
import { env, kafkaBrokers } from "../../config/env";

const { Pool } = pg;

export type CheckResult = {
  status: "ok" | "degraded";
  detail?: string;
};

const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const checkPostgres = async (): Promise<CheckResult> => {
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1, connectionTimeoutMillis: 1000 });
  try {
    await withTimeout(pool.query("select 1"), 1500, "postgres");
    return { status: "ok" };
  } catch (error) {
    return { status: "degraded", detail: error instanceof Error ? error.message : "postgres check failed" };
  } finally {
    await pool.end().catch(() => undefined);
  }
};

const checkRedis = async (): Promise<CheckResult> => {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    enableReadyCheck: false
  });

  try {
    await withTimeout(redis.connect(), 1500, "redis connect");
    await withTimeout(redis.ping(), 1500, "redis ping");
    return { status: "ok" };
  } catch (error) {
    return { status: "degraded", detail: error instanceof Error ? error.message : "redis check failed" };
  } finally {
    redis.disconnect();
  }
};

const checkKafka = async (): Promise<CheckResult> => {
  const kafka = new Kafka({ clientId: env.SERVICE_NAME, brokers: kafkaBrokers });
  const admin = kafka.admin();
  try {
    await withTimeout(admin.connect(), 2500, "kafka connect");
    await withTimeout(admin.listTopics(), 2500, "kafka list topics");
    return { status: "ok" };
  } catch (error) {
    return { status: "degraded", detail: error instanceof Error ? error.message : "kafka check failed" };
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
};

const checkRabbitMq = async (): Promise<CheckResult> => {
  try {
    const connection = await withTimeout(amqp.connect(env.RABBITMQ_URL), 2000, "rabbitmq connect");
    await connection.close();
    return { status: "ok" };
  } catch (error) {
    return { status: "degraded", detail: error instanceof Error ? error.message : "rabbitmq check failed" };
  }
};

export const dependencyChecks = async () => ({
  postgres: await checkPostgres(),
  redis: await checkRedis(),
  kafka: await checkKafka(),
  rabbitmq: await checkRabbitMq()
});
