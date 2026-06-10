import { Kafka, Producer } from "kafkajs";
import { env, kafkaBrokers } from "../../config/env";
import { logger } from "../logging/logger";

let producer: Producer | undefined;
let connecting: Promise<Producer> | undefined;

const kafka = new Kafka({
  clientId: `${env.SERVICE_NAME}-producer`,
  brokers: kafkaBrokers
});

async function getProducer() {
  if (producer) return producer;
  if (!connecting) {
    const nextProducer = kafka.producer();
    connecting = nextProducer.connect().then(() => {
      producer = nextProducer;
      return producer;
    });
  }
  return connecting;
}

export async function publishDomainEvent(topic: string, payload: Record<string, unknown>, key?: string) {
  try {
    const activeProducer = await getProducer();
    await activeProducer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify({
            eventType: topic,
            timestamp: new Date().toISOString(),
            ...payload
          })
        }
      ]
    });
  } catch (error) {
    logger.error({ error, topic, key }, "Failed to publish Kafka domain event");
  }
}
