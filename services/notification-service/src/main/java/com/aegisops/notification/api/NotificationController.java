package com.aegisops.notification.api;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.aegisops.notification.application.NotificationApplicationService;
import com.aegisops.notification.domain.NotificationProvider;
import com.aegisops.notification.dto.CreateNotificationSettingRequest;
import com.aegisops.notification.dto.SendNotificationRequest;
import com.aegisops.notification.dto.UpsertEscalationPolicyRequest;

@RestController
public class NotificationController {

  private final NotificationApplicationService notificationService;

  public NotificationController(NotificationApplicationService notificationService) {
    this.notificationService = notificationService;
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    return notificationService.health();
  }

  @PostMapping("/notifications/test")
  public ResponseEntity<Map<String, Object>> sendTestNotification(@RequestBody(required = false) Map<String, Object> payload) {
    return ResponseEntity.accepted().body(notificationService.sendTestNotification(payload));
  }

  @GetMapping({"/notifications/settings", "/settings"})
  public Map<String, Object> settings() {
    return notificationService.settings();
  }

  @GetMapping({"/notifications/settings/{orgId}", "/settings/{orgId}", "/notify/settings/{orgId}"})
  public Map<String, Object> settings(@PathVariable String orgId) {
    return notificationService.settings(orgId);
  }

  @PostMapping({"/notifications/settings", "/settings", "/notify/settings"})
  public ResponseEntity<Map<String, Object>> createSetting(@RequestBody CreateNotificationSettingRequest request) {
    return ResponseEntity.status(201).body(Map.of("setting", notificationService.createSetting(request)));
  }

  @PatchMapping({"/notifications/settings/{orgId}", "/settings/{orgId}", "/notify/settings/{orgId}"})
  public ResponseEntity<Map<String, Object>> updateSetting(
    @PathVariable String orgId,
    @RequestBody CreateNotificationSettingRequest request
  ) {
    CreateNotificationSettingRequest patchedRequest = new CreateNotificationSettingRequest(
      orgId,
      request == null ? null : request.provider(),
      request == null ? null : request.destination(),
      request == null ? null : request.enabled()
    );
    return ResponseEntity.ok(Map.of("setting", notificationService.createSetting(patchedRequest)));
  }

  @GetMapping({"/notifications/history", "/history", "/notify/history"})
  public Map<String, Object> history() {
    return notificationService.history();
  }

  @GetMapping({"/notifications/history/{orgId}", "/history/{orgId}", "/notify/history/{orgId}"})
  public Map<String, Object> history(@PathVariable String orgId) {
    return notificationService.history(orgId);
  }

  @PostMapping({"/notifications/email", "/email", "/notify/email"})
  public ResponseEntity<Map<String, Object>> sendEmail(@RequestBody SendNotificationRequest request) {
    return ResponseEntity.accepted().body(notificationService.send(NotificationProvider.EMAIL, request));
  }

  @PostMapping({"/notifications/slack", "/slack", "/notify/slack"})
  public ResponseEntity<Map<String, Object>> sendSlack(@RequestBody SendNotificationRequest request) {
    return ResponseEntity.accepted().body(notificationService.send(NotificationProvider.SLACK, request));
  }

  @PostMapping({"/notifications/discord", "/discord", "/notify/discord"})
  public ResponseEntity<Map<String, Object>> sendDiscord(@RequestBody SendNotificationRequest request) {
    return ResponseEntity.accepted().body(notificationService.send(NotificationProvider.DISCORD, request));
  }

  @GetMapping({"/notifications/escalation-policies", "/escalation-policies", "/notify/escalation-policies"})
  public Map<String, Object> escalationPolicies() {
    return notificationService.escalationPolicies();
  }

  @GetMapping({
    "/notifications/escalation-policies/{orgId}",
    "/escalation-policies/{orgId}",
    "/notify/escalation-policies/{orgId}"
  })
  public Map<String, Object> escalationPolicies(@PathVariable String orgId) {
    return notificationService.escalationPolicies(orgId);
  }

  @PostMapping({"/notifications/escalation-policies", "/escalation-policies", "/notify/escalation-policies"})
  public ResponseEntity<Map<String, Object>> upsertEscalationPolicy(@RequestBody UpsertEscalationPolicyRequest request) {
    return ResponseEntity.status(201).body(Map.of("policy", notificationService.upsertEscalationPolicy(request)));
  }

  @PatchMapping({
    "/notifications/escalation-policies/{orgId}",
    "/escalation-policies/{orgId}",
    "/notify/escalation-policies/{orgId}"
  })
  public ResponseEntity<Map<String, Object>> upsertEscalationPolicy(
    @PathVariable String orgId,
    @RequestBody UpsertEscalationPolicyRequest request
  ) {
    UpsertEscalationPolicyRequest patchedRequest = new UpsertEscalationPolicyRequest(
      orgId,
      request == null ? null : request.name(),
      request == null ? null : request.severity(),
      request == null ? null : request.providers(),
      request == null ? null : request.enabled()
    );
    return ResponseEntity.ok(Map.of("policy", notificationService.upsertEscalationPolicy(patchedRequest)));
  }
}
