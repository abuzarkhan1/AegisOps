import { createApp } from "./app";
import { env, kafkaBrokers } from "./config/env";
import { KafkaEventConsumer } from "./infrastructure/kafka/consumer";
import { logger } from "./infrastructure/logging/logger";
import { ensureRabbitMqQueues } from "./infrastructure/rabbitmq/bootstrap";
import { RabbitMqTaskPublisher } from "./infrastructure/rabbitmq/publisher";
import { RabbitMqTaskConsumer } from "./infrastructure/rabbitmq/consumer";
import { kafkaTopicsConsumed, rabbitMqQueuesProduced } from "./queues/catalog";
import { runRollups, runRetention } from "./workflows/jobs";

const app = createApp();
const publisher = new RabbitMqTaskPublisher();
let kafkaConsumer: KafkaEventConsumer | undefined;
let rabbitConsumer: RabbitMqTaskConsumer | undefined;
let rollupJobRunning = false;
let retentionJobRunning = false;

async function runRollupJob(source: string) {
  if (rollupJobRunning) {
    logger.warn({ source }, "Skipping rollup job because a previous run is still active");
    return;
  }

  rollupJobRunning = true;
  try {
    await runRollups();
  } catch (error) {
    logger.error({ error, source }, "Error in rollup job");
  } finally {
    rollupJobRunning = false;
  }
}

async function runRetentionJob(source: string) {
  if (retentionJobRunning) {
    logger.warn({ source }, "Skipping retention job because a previous run is still active");
    return;
  }

  retentionJobRunning = true;
  try {
    await runRetention();
  } catch (error) {
    logger.error({ error, source }, "Error in retention job");
  } finally {
    retentionJobRunning = false;
  }
}

async function start() {
  try {
    await ensureRabbitMqQueues();
    await publisher.connect();
  } catch (error) {
    logger.error({ error }, "RabbitMQ queue bootstrap or publisher connection failed");
  }

  if (env.WORKER_CONSUMERS_ENABLED) {
    try {
      kafkaConsumer = new KafkaEventConsumer(publisher);
      await kafkaConsumer.start();

      rabbitConsumer = new RabbitMqTaskConsumer(publisher);
      await rabbitConsumer.start();
    } catch (error) {
      logger.error({ error }, "Consumers startup failed");
    }
  }

  // Scheduled background jobs
  setInterval(() => {
    void runRollupJob("scheduler");
  }, 60_000);

  setInterval(() => {
    void runRetentionJob("scheduler");
  }, 3_600_000);

  // Trigger once shortly after startup
  setTimeout(() => {
    void runRollupJob("startup");
    void runRetentionJob("startup");
  }, 5_000);

  app.listen(env.PORT, "0.0.0.0", () => {
    logger.info(
      {
        port: env.PORT,
        kafkaBrokers,
        consumerGroup: env.KAFKA_CONSUMER_GROUP,
        kafkaTopicsConsumed,
        rabbitMqQueuesProduced
      },
      "Worker service ready for event orchestration"
    );
  });
}

const shutdown = async () => {
  logger.info("Worker service shutting down");
  await kafkaConsumer?.stop();
  await rabbitConsumer?.stop().catch(() => undefined);
  await publisher.close();
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});

start().catch((error) => {
  logger.error({ error }, "Worker service failed to start");
  process.exit(1);
});
