import * as amqp from "amqplib";
import { env } from "../../config/env";
import { failedQueueFor, rabbitMqQueuesProduced } from "../../queues/catalog";
import { logger } from "../logging/logger";

export async function ensureRabbitMqQueues() {
  const connection = await amqp.connect(env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  try {
    await channel.assertExchange("aegisops.dlx", "direct", { durable: true });
    for (const queue of rabbitMqQueuesProduced) {
      const failedQueue = failedQueueFor(queue);
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "aegisops.dlx",
          "x-dead-letter-routing-key": failedQueue
        }
      });
      await channel.assertQueue(failedQueue, { durable: true });
      await channel.bindQueue(failedQueue, "aegisops.dlx", failedQueue);
    }
    logger.info({ queues: rabbitMqQueuesProduced }, "RabbitMQ task queues ready");
  } finally {
    await channel.close().catch(() => undefined);
    await connection.close().catch(() => undefined);
  }
}
