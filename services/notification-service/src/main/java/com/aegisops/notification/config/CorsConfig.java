package com.aegisops.notification.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry
      .addMapping("/**")
      .allowedOrigins("*")
      .allowedMethods("GET", "POST", "PATCH", "OPTIONS")
      .allowedHeaders("Authorization", "Content-Type", "X-Requested-With", "X-Request-ID")
      .maxAge(86400);
  }
}
