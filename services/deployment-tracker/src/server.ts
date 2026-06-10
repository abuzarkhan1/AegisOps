import { createApp } from "./app";
import { env, kafkaBrokers } from "./config/env";
import { logger } from "./infrastructure/logging/logger";

const app = createApp();

app.listen(env.PORT, "0.0.0.0", () => {
  logger.info({ port: env.PORT, kafkaBrokers, topic: "deployments.created" }, "Deployment tracker ready");
});

