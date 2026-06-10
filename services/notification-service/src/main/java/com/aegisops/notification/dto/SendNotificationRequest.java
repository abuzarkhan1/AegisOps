package com.aegisops.notification.dto;

import java.util.Map;

public record SendNotificationRequest(
  String organizationId,
  String destination,
  String subject,
  String message,
  Map<String, Object> payload
) {}

