package com.aegisops.notification.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class NotificationRuntimeProperties {

  @Value("${spring.application.name:notification-service}")
  private String serviceName;

  @Value("${SPRING_RABBITMQ_HOST:localhost}")
  private String rabbitHost;

  @Value("${SPRING_RABBITMQ_PORT:5672}")
  private String rabbitPort;

  @Value("${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/aegisops}")
  private String datasourceUrl;

  @Value("${SPRING_DATA_REDIS_HOST:localhost}")
  private String redisHost;

  public String serviceName() {
    return serviceName;
  }

  public String rabbitHost() {
    return rabbitHost;
  }

  public String rabbitPort() {
    return rabbitPort;
  }

  public String datasourceUrl() {
    int queryIndex = datasourceUrl.indexOf('?');
    return queryIndex >= 0 ? datasourceUrl.substring(0, queryIndex) : datasourceUrl;
  }

  public String redisHost() {
    return redisHost;
  }
}
