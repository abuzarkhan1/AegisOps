package com.aegisops.notification.domain;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record NotificationHistoryEntry(
  UUID id,
  String organizationId,
  NotificationProvider provider,
  NotificationStatus status,
  String subject,
  String destination,
  Map<String, Object> payload,
  Instant createdAt
) {}

