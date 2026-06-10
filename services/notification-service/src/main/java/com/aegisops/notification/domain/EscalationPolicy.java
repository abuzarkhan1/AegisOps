package com.aegisops.notification.domain;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record EscalationPolicy(
  UUID id,
  String organizationId,
  String name,
  String severity,
  List<NotificationProvider> providers,
  boolean enabled,
  Instant createdAt
) {}
