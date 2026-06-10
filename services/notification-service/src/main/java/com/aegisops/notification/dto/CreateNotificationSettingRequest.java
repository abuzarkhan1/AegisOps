package com.aegisops.notification.dto;

import com.aegisops.notification.domain.NotificationProvider;

public record CreateNotificationSettingRequest(
  String organizationId,
  NotificationProvider provider,
  String destination,
  Boolean enabled
) {}

