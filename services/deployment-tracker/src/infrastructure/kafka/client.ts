import { Kafka } from "kafkajs";
import { env, kafkaBrokers } from "../../config/env";

export const kafka = new Kafka({ clientId: env.SERVICE_NAME, brokers: kafkaBrokers });

export const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const checkKafka = async () => {
  const admin = kafka.admin();
  try {
    await withTimeout(admin.connect(), 2500, "kafka connect");
    await withTimeout(admin.listTopics(), 2500, "kafka list topics");
    return { status: "ok" as const };
  } catch (error) {
    return { status: "degraded" as const, detail: error instanceof Error ? error.message : "kafka check failed" };
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
};

export const publishDeployment = async (deployment: unknown, key: string) => {
  const producer = kafka.producer();
  try {
    await withTimeout(producer.connect(), 2500, "kafka producer connect");
    await withTimeout(
      producer.send({
        topic: "deployments.created",
        messages: [{ key, value: JSON.stringify(deployment) }]
      }),
      3000,
      "kafka publish deployment"
    );
  } finally {
    await producer.disconnect().catch(() => undefined);
  }
};

