package com.aegisops.notification.messaging;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import com.aegisops.notification.application.NotificationApplicationService;
import com.aegisops.notification.config.NotificationQueueNames;
import com.aegisops.notification.domain.NotificationProvider;

@Component
public class NotificationTaskConsumer {

  private static final Logger logger = LoggerFactory.getLogger(NotificationTaskConsumer.class);

  private final NotificationApplicationService notificationService;

  public NotificationTaskConsumer(NotificationApplicationService notificationService) {
    this.notificationService = notificationService;
  }

  @RabbitListener(queues = {
    NotificationQueueNames.EMAIL,
    NotificationQueueNames.SLACK,
    NotificationQueueNames.DISCORD,
    NotificationQueueNames.INCIDENT_ESCALATE
  })
  public void consume(Map<String, Object> task, @Header(AmqpHeaders.CONSUMER_QUEUE) String queue) {
    Map<String, Object> result = switch (queue) {
      case NotificationQueueNames.EMAIL -> notificationService.sendQueuedNotification(NotificationProvider.EMAIL, task);
      case NotificationQueueNames.SLACK -> notificationService.sendQueuedNotification(NotificationProvider.SLACK, task);
      case NotificationQueueNames.DISCORD -> notificationService.sendQueuedNotification(NotificationProvider.DISCORD, task);
      case NotificationQueueNames.INCIDENT_ESCALATE -> notificationService.escalate(task);
      default -> throw new IllegalArgumentException("Unsupported notification queue: " + queue);
    };
    logger.info("Notification task consumed from {} with result {}", queue, result);
  }
}
