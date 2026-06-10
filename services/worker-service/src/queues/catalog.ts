export const kafkaTopicsConsumed = [
  "logs.received",
  "logs.enriched",
  "metrics.received",
  "metrics.aggregated",
  "deployments.created",
  "deployments.completed",
  "deployment.impact.generated",
  "incidents.created",
  "incidents.updated",
  "incidents.resolved",
  "alerts.triggered",
  "service.health.changed",
  "audit.events"
];

export const rabbitMqQueuesProduced = [
  "ai.analysis.requested",
  "ai.postmortem.generate",
  "notification.email.send",
  "notification.slack.send",
  "notification.discord.send",
  "report.daily.generate",
  "report.weekly.generate",
  "incident.escalate",
  "deployment.impact.analyze"
];

const failedQueueNames: Record<string, string> = {
  "ai.analysis.requested": "ai.analysis.failed",
  "ai.postmortem.generate": "ai.postmortem.failed",
  "notification.email.send": "notification.email.failed",
  "notification.slack.send": "notification.slack.failed",
  "notification.discord.send": "notification.discord.failed",
  "report.daily.generate": "report.daily.failed",
  "report.weekly.generate": "report.weekly.failed",
  "incident.escalate": "incident.escalate.failed",
  "deployment.impact.analyze": "deployment.impact.failed"
};

export const failedQueueFor = (queue: string) => failedQueueNames[queue] ?? `${queue}.failed`;
