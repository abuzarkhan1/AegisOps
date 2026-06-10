package com.aegisops.notification.config;

import java.util.Map;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfiguration {

  @Bean
  public DirectExchange notificationDeadLetterExchange() {
    return new DirectExchange(NotificationQueueNames.DEAD_LETTER_EXCHANGE, true, false);
  }

  @Bean
  public MessageConverter jacksonMessageConverter() {
    return new Jackson2JsonMessageConverter();
  }

  @Bean
  public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
    ConnectionFactory connectionFactory,
    MessageConverter messageConverter
  ) {
    SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
    factory.setConnectionFactory(connectionFactory);
    factory.setMessageConverter(messageConverter);
    factory.setDefaultRequeueRejected(false);
    return factory;
  }

  @Bean
  public Queue notificationEmailQueue() {
    return durableQueue(NotificationQueueNames.EMAIL);
  }

  @Bean
  public Queue notificationSlackQueue() {
    return durableQueue(NotificationQueueNames.SLACK);
  }

  @Bean
  public Queue notificationDiscordQueue() {
    return durableQueue(NotificationQueueNames.DISCORD);
  }

  @Bean
  public Queue incidentEscalateQueue() {
    return durableQueue(NotificationQueueNames.INCIDENT_ESCALATE);
  }

  @Bean
  public Queue notificationEmailFailedQueue() {
    return failedQueue(NotificationQueueNames.EMAIL);
  }

  @Bean
  public Queue notificationSlackFailedQueue() {
    return failedQueue(NotificationQueueNames.SLACK);
  }

  @Bean
  public Queue notificationDiscordFailedQueue() {
    return failedQueue(NotificationQueueNames.DISCORD);
  }

  @Bean
  public Queue incidentEscalateFailedQueue() {
    return failedQueue(NotificationQueueNames.INCIDENT_ESCALATE);
  }

  @Bean
  public Binding notificationEmailFailedBinding(DirectExchange notificationDeadLetterExchange) {
    return failedBinding(notificationEmailFailedQueue(), notificationDeadLetterExchange);
  }

  @Bean
  public Binding notificationSlackFailedBinding(DirectExchange notificationDeadLetterExchange) {
    return failedBinding(notificationSlackFailedQueue(), notificationDeadLetterExchange);
  }

  @Bean
  public Binding notificationDiscordFailedBinding(DirectExchange notificationDeadLetterExchange) {
    return failedBinding(notificationDiscordFailedQueue(), notificationDeadLetterExchange);
  }

  @Bean
  public Binding incidentEscalateFailedBinding(DirectExchange notificationDeadLetterExchange) {
    return failedBinding(incidentEscalateFailedQueue(), notificationDeadLetterExchange);
  }

  private Queue durableQueue(String queue) {
    return QueueBuilder.durable(queue)
      .withArguments(Map.of(
        "x-dead-letter-exchange", NotificationQueueNames.DEAD_LETTER_EXCHANGE,
        "x-dead-letter-routing-key", NotificationQueueNames.failedQueue(queue)
      ))
      .build();
  }

  private Queue failedQueue(String queue) {
    return QueueBuilder.durable(NotificationQueueNames.failedQueue(queue)).build();
  }

  private Binding failedBinding(Queue failedQueue, DirectExchange deadLetterExchange) {
    return BindingBuilder.bind(failedQueue).to(deadLetterExchange).with(failedQueue.getName());
  }
}
