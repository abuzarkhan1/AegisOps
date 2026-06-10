import { env, kafkaBrokers } from "./config/env";
import { createApp } from "./app";
import { logger } from "./infrastructure/logging/logger";

const app = createApp();

app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(
    {
      port: env.PORT,
      kafkaBrokers,
      redis: env.REDIS_URL,
      databaseConfigured: Boolean(env.DATABASE_URL),
      rabbitmqConfigured: Boolean(env.RABBITMQ_URL)
    },
    "Core API ready"
  );
});

