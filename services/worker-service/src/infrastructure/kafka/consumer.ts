import { Kafka } from "kafkajs";
import { env, kafkaBrokers } from "../../config/env";
import type { AegisOpsEvent } from "../../events/event.types";
import { logger } from "../logging/logger";
import type { RabbitMqTaskPublisher } from "../rabbitmq/publisher";
import { kafkaTopicsConsumed } from "../../queues/catalog";
import { processEvent } from "../../workflows/eventWorkflow";

export class KafkaEventConsumer {
  private readonly kafka = new Kafka({ clientId: env.SERVICE_NAME, brokers: kafkaBrokers });
  private readonly consumer = this.kafka.consumer({ groupId: env.KAFKA_CONSUMER_GROUP });

  constructor(private readonly publisher: RabbitMqTaskPublisher) {}

  async start() {
    await this.consumer.connect();
    for (const topic of kafkaTopicsConsumed) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const value = message.value?.toString("utf8") ?? "{}";
        let payload: AegisOpsEvent;
        try {
          payload = JSON.parse(value) as AegisOpsEvent;
        } catch (error) {
          logger.error({ error, topic, value }, "Skipping malformed Kafka event");
          return;
        }

        try {
          await processEvent(topic, payload, this.publisher);
          logger.info({ topic, key: message.key?.toString("utf8") }, "Kafka event processed");
        } catch (error) {
          logger.error({ error, topic, payload }, "Kafka event processing failed");
        }
      }
    });
    logger.info({ topics: kafkaTopicsConsumed, groupId: env.KAFKA_CONSUMER_GROUP }, "Kafka consumer running");
  }

  async stop() {
    await this.consumer.disconnect().catch(() => undefined);
  }
}

