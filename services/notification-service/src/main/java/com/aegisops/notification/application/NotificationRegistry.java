package com.aegisops.notification.application;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Component;

import com.aegisops.notification.domain.EscalationPolicy;
import com.aegisops.notification.domain.NotificationHistoryEntry;
import com.aegisops.notification.domain.NotificationProvider;
import com.aegisops.notification.domain.NotificationSetting;
import com.aegisops.notification.domain.NotificationStatus;

@Component
public class NotificationRegistry {

  private final List<NotificationSetting> settings = new CopyOnWriteArrayList<>();
  private final List<NotificationHistoryEntry> history = new CopyOnWriteArrayList<>();
  private final List<EscalationPolicy> escalationPolicies = new CopyOnWriteArrayList<>();

  public NotificationSetting addSetting(String organizationId, NotificationProvider provider, String destination, boolean enabled) {
    settings.removeIf(setting -> setting.organizationId().equals(organizationId) && setting.provider() == provider);
    NotificationSetting setting = new NotificationSetting(
      UUID.randomUUID(),
      organizationId,
      provider,
      destination,
      enabled,
      Instant.now()
    );
    settings.add(setting);
    return setting;
  }

  public List<NotificationSetting> settings() {
    return sortedSettings(settings);
  }

  public List<NotificationSetting> settings(String organizationId) {
    return sortedSettings(settings.stream()
      .filter(setting -> setting.organizationId().equals(organizationId))
      .toList());
  }

  public Optional<NotificationSetting> firstEnabledSetting(String organizationId, NotificationProvider provider) {
    return settings.stream()
      .filter(setting -> setting.organizationId().equals(organizationId))
      .filter(setting -> setting.provider() == provider)
      .filter(NotificationSetting::enabled)
      .findFirst();
  }

  private List<NotificationSetting> sortedSettings(List<NotificationSetting> source) {
    return source.stream()
      .sorted(Comparator.comparing(NotificationSetting::createdAt).reversed())
      .toList();
  }

  public NotificationHistoryEntry record(
    String organizationId,
    NotificationProvider provider,
    NotificationStatus status,
    String subject,
    String destination,
    Map<String, Object> payload
  ) {
    NotificationHistoryEntry entry = new NotificationHistoryEntry(
      UUID.randomUUID(),
      organizationId,
      provider,
      status,
      subject,
      destination,
      payload == null ? Map.of() : payload,
      Instant.now()
    );
    history.add(entry);
    return entry;
  }

  public List<NotificationHistoryEntry> history() {
    return sortedHistory(history);
  }

  public List<NotificationHistoryEntry> history(String organizationId) {
    return sortedHistory(history.stream()
      .filter(entry -> entry.organizationId().equals(organizationId))
      .toList());
  }

  private List<NotificationHistoryEntry> sortedHistory(List<NotificationHistoryEntry> source) {
    List<NotificationHistoryEntry> copy = new ArrayList<>(source);
    copy.sort(Comparator.comparing(NotificationHistoryEntry::createdAt).reversed());
    return copy;
  }

  public EscalationPolicy upsertEscalationPolicy(
    String organizationId,
    String name,
    String severity,
    List<NotificationProvider> providers,
    boolean enabled
  ) {
    escalationPolicies.removeIf(policy -> policy.organizationId().equals(organizationId) && policy.name().equalsIgnoreCase(name));
    EscalationPolicy policy = new EscalationPolicy(
      UUID.randomUUID(),
      organizationId,
      name,
      severity,
      providers == null || providers.isEmpty() ? List.of(NotificationProvider.EMAIL, NotificationProvider.SLACK) : List.copyOf(providers),
      enabled,
      Instant.now()
    );
    escalationPolicies.add(policy);
    return policy;
  }

  public List<EscalationPolicy> escalationPolicies() {
    return sortedPolicies(escalationPolicies);
  }

  public List<EscalationPolicy> escalationPolicies(String organizationId) {
    return sortedPolicies(escalationPolicies.stream()
      .filter(policy -> policy.organizationId().equals(organizationId))
      .toList());
  }

  private List<EscalationPolicy> sortedPolicies(List<EscalationPolicy> source) {
    return source.stream()
      .sorted(Comparator.comparing(EscalationPolicy::createdAt).reversed())
      .toList();
  }
}
