import * as amqp from "amqplib";
import { env } from "../../config/env";
import { logger } from "../logging/logger";
import { failedQueueFor, rabbitMqQueuesProduced } from "../../queues/catalog";
import type { WorkerTask } from "../../events/event.types";

const queueOptions = (queue: string): amqp.Options.AssertQueue => ({
  durable: true,
  arguments: {
    "x-dead-letter-exchange": "aegisops.dlx",
    "x-dead-letter-routing-key": failedQueueFor(queue)
  }
});

export class RabbitMqTaskPublisher {
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;

  async connect() {
    this.connection = await amqp.connect(env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange("aegisops.dlx", "direct", { durable: true });
    for (const queue of rabbitMqQueuesProduced) {
      const failedQueue = failedQueueFor(queue);
      await this.channel.assertQueue(queue, queueOptions(queue));
      await this.channel.assertQueue(failedQueue, { durable: true });
      await this.channel.bindQueue(failedQueue, "aegisops.dlx", failedQueue);
    }
    logger.info({ queues: rabbitMqQueuesProduced }, "RabbitMQ task publisher connected");
  }

  async publish(queue: string, task: WorkerTask) {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not connected");
    }
    const accepted = this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(task)), {
      contentType: "application/json",
      deliveryMode: 2,
      timestamp: Date.now()
    });
    if (!accepted) {
      logger.warn({ queue, taskType: task.taskType }, "RabbitMQ write buffer is full");
    }
  }

  async close() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
