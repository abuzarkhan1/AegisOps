package com.aegisops.notification.dto;

import java.util.List;

import com.aegisops.notification.domain.NotificationProvider;

public record UpsertEscalationPolicyRequest(
  String organizationId,
  String name,
  String severity,
  List<NotificationProvider> providers,
  Boolean enabled
) {}
