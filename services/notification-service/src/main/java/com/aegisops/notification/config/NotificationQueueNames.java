package com.aegisops.notification.config;

public final class NotificationQueueNames {

  public static final String DEAD_LETTER_EXCHANGE = "aegisops.dlx";
  public static final String EMAIL = "notification.email.send";
  public static final String SLACK = "notification.slack.send";
  public static final String DISCORD = "notification.discord.send";
  public static final String INCIDENT_ESCALATE = "incident.escalate";

  private NotificationQueueNames() {}

  public static String failedQueue(String queue) {
    return switch (queue) {
      case EMAIL -> "notification.email.failed";
      case SLACK -> "notification.slack.failed";
      case DISCORD -> "notification.discord.failed";
      case INCIDENT_ESCALATE -> "incident.escalate.failed";
      default -> queue + ".failed";
    };
  }
}
