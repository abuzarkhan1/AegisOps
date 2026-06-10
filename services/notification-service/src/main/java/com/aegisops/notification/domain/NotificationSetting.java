package com.aegisops.notification.domain;

import java.time.Instant;
import java.util.UUID;

public record NotificationSetting(
  UUID id,
  String organizationId,
  NotificationProvider provider,
  String destination,
  boolean enabled,
  Instant createdAt
) {}

