package com.aegisops.notification.application;

import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.aegisops.notification.domain.EscalationPolicy;
import com.aegisops.notification.config.NotificationRuntimeProperties;
import com.aegisops.notification.domain.NotificationHistoryEntry;
import com.aegisops.notification.domain.NotificationProvider;
import com.aegisops.notification.domain.NotificationSetting;
import com.aegisops.notification.domain.NotificationStatus;
import com.aegisops.notification.dto.CreateNotificationSettingRequest;
import com.aegisops.notification.dto.SendNotificationRequest;
import com.aegisops.notification.dto.UpsertEscalationPolicyRequest;

@Service
public class NotificationApplicationService {

  private final NotificationRuntimeProperties properties;
  private final NotificationRegistry registry;

  public NotificationApplicationService(NotificationRuntimeProperties properties, NotificationRegistry registry) {
    this.properties = properties;
    this.registry = registry;
  }

  public Map<String, Object> health() {
    Map<String, Object> checks = new LinkedHashMap<>();
    checks.put("rabbitmqConfigured", Map.of("status", "ok", "host", properties.rabbitHost(), "port", properties.rabbitPort()));
    checks.put("postgresConfigured", Map.of("status", "ok", "url", properties.datasourceUrl()));
    checks.put("redisConfigured", Map.of("status", "ok", "host", properties.redisHost()));

    return Map.of(
      "status", "ok",
      "healthStatus", "healthy",
      "service", properties.serviceName(),
      "timestamp", Instant.now().toString(),
      "mode", "local",
      "dependencies", Map.of(
        "postgres", "configured",
        "redis", "configured",
        "kafka", "not_required",
        "rabbitmq", "configured"
      ),
      "checks", checks
    );
  }

  public Map<String, Object> sendTestNotification(Map<String, Object> payload) {
    NotificationHistoryEntry entry = registry.record(
      "local",
      NotificationProvider.EMAIL,
      NotificationStatus.ACCEPTED,
      "Test notification",
      "mock://local",
      payload
    );
    return Map.of(
      "status", "accepted",
      "service", properties.serviceName(),
      "provider", "mock",
      "historyId", entry.id(),
      "payload", payload == null ? Map.of() : payload
    );
  }

  public NotificationSetting createSetting(CreateNotificationSettingRequest request) {
    CreateNotificationSettingRequest safeRequest = request == null
      ? new CreateNotificationSettingRequest("local", NotificationProvider.EMAIL, "mock://local", true)
      : request;
    return registry.addSetting(
      organizationId(safeRequest.organizationId()),
      safeRequest.provider() == null ? NotificationProvider.EMAIL : safeRequest.provider(),
      blankToDefault(safeRequest.destination(), "mock://local"),
      safeRequest.enabled() == null || safeRequest.enabled()
    );
  }

  public Map<String, Object> settings() {
    return Map.of("settings", registry.settings());
  }

  public Map<String, Object> settings(String organizationId) {
    return Map.of("settings", registry.settings(organizationId(organizationId)));
  }

  public Map<String, Object> history() {
    return Map.of("history", registry.history());
  }

  public Map<String, Object> history(String organizationId) {
    return Map.of("history", registry.history(organizationId(organizationId)));
  }

  public Map<String, Object> send(NotificationProvider provider, SendNotificationRequest request) {
    SendNotificationRequest safeRequest = request == null
      ? new SendNotificationRequest("local", null, null, null, Map.of())
      : request;
    String organizationId = organizationId(safeRequest.organizationId());
    String destination = blankToDefault(
      safeRequest.destination(),
      registry.firstEnabledSetting(organizationId, provider)
        .map(NotificationSetting::destination)
        .orElse("mock://local")
    );
    NotificationHistoryEntry entry = registry.record(
      organizationId,
      provider,
      NotificationStatus.ACCEPTED,
      blankToDefault(safeRequest.subject(), "AegisOps notification"),
      destination,
      safeRequest.payload()
    );

    return Map.of(
      "status", "accepted",
      "provider", provider,
      "destination", destination,
      "historyId", entry.id(),
      "message", safeRequest.message() == null ? "" : safeRequest.message()
    );
  }

  public Map<String, Object> sendQueuedNotification(NotificationProvider provider, Map<String, Object> task) {
    Map<String, Object> payload = nestedPayload(task);
    String organizationId = organizationId(stringValue(payload.get("organizationId"), stringValue(task.get("organizationId"), "local")));
    String title = stringValue(payload.get("title"), stringValue(payload.get("summary"), "AegisOps incident notification"));
    String destination = registry.firstEnabledSetting(organizationId, provider)
      .map(NotificationSetting::destination)
      .orElse("mock://local");

    NotificationHistoryEntry entry = registry.record(
      organizationId,
      provider,
      NotificationStatus.ACCEPTED,
      title,
      destination,
      Map.of(
        "sourceTopic", stringValue(task.get("sourceTopic"), "rabbitmq"),
        "taskType", stringValue(task.get("taskType"), provider.name().toLowerCase()),
        "payload", payload
      )
    );

    return Map.of(
      "status", "accepted",
      "provider", provider,
      "destination", destination,
      "historyId", entry.id()
    );
  }

  public Map<String, Object> escalate(Map<String, Object> task) {
    Map<String, Object> payload = nestedPayload(task);
    String organizationId = organizationId(stringValue(payload.get("organizationId"), stringValue(task.get("organizationId"), "local")));
    List<EscalationPolicy> policies = registry.escalationPolicies(organizationId).stream()
      .filter(EscalationPolicy::enabled)
      .toList();
    List<NotificationProvider> providers = policies.isEmpty()
      ? List.of(NotificationProvider.EMAIL, NotificationProvider.SLACK)
      : policies.stream().flatMap(policy -> policy.providers().stream()).distinct().toList();

    List<NotificationHistoryEntry> entries = providers.stream()
      .map(provider -> registry.record(
        organizationId,
        provider,
        NotificationStatus.ACCEPTED,
        "Incident escalation",
        registry.firstEnabledSetting(organizationId, provider).map(NotificationSetting::destination).orElse("escalation://on-call"),
        Map.of("source", "incident.escalate", "payload", payload)
      ))
      .toList();

    return Map.of(
      "status", "accepted",
      "organizationId", organizationId,
      "providerCount", providers.size(),
      "historyIds", entries.stream().map(NotificationHistoryEntry::id).toList()
    );
  }

  public EscalationPolicy upsertEscalationPolicy(UpsertEscalationPolicyRequest request) {
    UpsertEscalationPolicyRequest safeRequest = request == null
      ? new UpsertEscalationPolicyRequest("local", "Default escalation", "high", List.of(NotificationProvider.EMAIL, NotificationProvider.SLACK), true)
      : request;
    return registry.upsertEscalationPolicy(
      organizationId(safeRequest.organizationId()),
      blankToDefault(safeRequest.name(), "Default escalation"),
      blankToDefault(safeRequest.severity(), "high"),
      safeRequest.providers(),
      safeRequest.enabled() == null || safeRequest.enabled()
    );
  }

  public Map<String, Object> escalationPolicies() {
    return Map.of("policies", registry.escalationPolicies());
  }

  public Map<String, Object> escalationPolicies(String organizationId) {
    return Map.of("policies", registry.escalationPolicies(organizationId(organizationId)));
  }

  private String organizationId(String organizationId) {
    return blankToDefault(organizationId, "local");
  }

  private String blankToDefault(String value, String defaultValue) {
    return value == null || value.isBlank() ? defaultValue : value;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> nestedPayload(Map<String, Object> task) {
    if (task == null) {
      return Map.of();
    }
    Object payload = task.get("payload");
    if (payload instanceof Map<?, ?> payloadMap) {
      return (Map<String, Object>) payloadMap;
    }
    return task;
  }

  private String stringValue(Object value, String defaultValue) {
    if (value == null) {
      return defaultValue;
    }
    String text = value.toString();
    return text.isBlank() ? defaultValue : text;
  }
}
