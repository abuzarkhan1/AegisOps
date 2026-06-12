import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpen, Building2, ExternalLink, LogOut, Menu, RefreshCw, Settings, ShieldCheck, UserCircle, Users } from "lucide-react";
import { coreApiUrl } from "../../app/config";
import { navigationItems } from "../../app/navigation";
import { useAuth } from "../../app/auth";
import { queryKeys, queryStaleTimes } from "../../app/queryClient";
import { fetchNotificationHistory, fetchOrganizations, type NotificationHistoryRecord, type OrganizationRecord } from "../api/core";
import { IconButton } from "../ui/IconButton";
import { Button } from "../ui/Button";
import { Drawer, DrawerPanel } from "../ui/Overlays";
import { StatusPill } from "../ui/StatusPill";
import type { HealthState } from "../api/health";
import { CommandSearch } from "./CommandSearch";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { TimeRangePicker } from "./TimeRangePicker";

export function Topbar({
  activeNav,
  status,
  onNavigate,
  onMobileMenu
}: {
  activeNav: string;
  status: HealthState;
  onNavigate: (label: string) => void;
  onMobileMenu: () => void;
}) {
  const { user, logout } = useAuth();
  const activeItem = navigationItems.find((item) => item.label === activeNav);
  const [docsOpen, setDocsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationHistoryRecord[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const { data: organizations = [] } = useQuery<OrganizationRecord[]>({
    queryKey: queryKeys.organizations(),
    queryFn: fetchOrganizations,
    staleTime: queryStaleTimes.settings,
    enabled: profileOpen
  });

  const activeOrganization = useMemo(() => organizations[0], [organizations]);

  async function loadNotifications() {
    setLoadingNotifications(true);
    try {
      setNotifications((await fetchNotificationHistory()).slice(0, 8));
    } finally {
      setLoadingNotifications(false);
    }
  }

  useEffect(() => {
    if (!notificationsOpen) return;
    loadNotifications().catch(() => setNotifications([]));
  }, [notificationsOpen]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    function closeProfile(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setProfileOpen(false);
        return;
      }
      if (event instanceof MouseEvent && profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("keydown", closeProfile);
    document.addEventListener("mousedown", closeProfile);
    return () => {
      document.removeEventListener("keydown", closeProfile);
      document.removeEventListener("mousedown", closeProfile);
    };
  }, [profileOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-black/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <IconButton label="Open navigation" className="lg:hidden" onClick={onMobileMenu}>
          <Menu className="h-4 w-4" />
        </IconButton>
        <div className="hidden min-w-[160px] md:block">
          <p className="text-xs uppercase text-text-muted/70">{activeItem?.group ?? "AegisOps"}</p>
          <h1 className="truncate text-sm font-semibold text-white">{activeNav}</h1>
        </div>
        <CommandSearch onNavigate={onNavigate} />
        <EnvironmentSwitcher />
        <TimeRangePicker />
        <StatusPill status={status} />
        <IconButton label="Open documentation" onClick={() => setDocsOpen(true)}>
          <BookOpen className="h-4 w-4" />
        </IconButton>
        <div className="relative">
          <IconButton label="Notifications" onClick={() => setNotificationsOpen(true)}>
            <Bell className="h-4 w-4" />
          </IconButton>
          {notifications.length > 0 ? (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose" aria-live="polite" />
          ) : null}
        </div>
        <div className="relative" ref={profileRef}>
          <IconButton label="User profile" onClick={() => setProfileOpen((value) => !value)}>
            <UserCircle className="h-4 w-4" />
          </IconButton>
          {profileOpen ? (
            <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-line bg-panel p-3 shadow-panel">
              <div className="flex items-start gap-3 border-b border-line pb-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-white/10 text-sm font-bold text-white">
                  {(user?.name ?? activeOrganization?.name ?? "AegisOps").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{user?.name ?? "AegisOps user"}</p>
                  <p className="truncate text-xs text-text-muted">{user?.email ?? activeOrganization?.name ?? "workspace"}</p>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-line bg-panel-soft px-3 py-2 text-xs text-text-soft">
                {activeOrganization?.name ?? "No organization selected"} / {user?.role ?? "member"}
              </div>
              <div className="mt-3 grid gap-1">
                <ProfileAction
                  icon={<Settings className="h-4 w-4" />}
                  label="Settings"
                  onClick={() => {
                    onNavigate("Settings");
                    setProfileOpen(false);
                  }}
                />
                <ProfileAction
                  icon={<Users className="h-4 w-4" />}
                  label="Team"
                  onClick={() => {
                    onNavigate("Team");
                    setProfileOpen(false);
                  }}
                />
                <ProfileAction
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Audit Logs"
                  onClick={() => {
                    onNavigate("Audit Logs");
                    setProfileOpen(false);
                  }}
                />
                <ProfileAction
                  icon={<LogOut className="h-4 w-4" />}
                  label="Sign Out"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Drawer open={docsOpen} title="Documentation" onClose={() => setDocsOpen(false)}>
        <div className="grid gap-3">
          <DrawerPanel>
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-5 w-5 text-white" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">Project Integration</h3>
                <p className="mt-1 text-sm text-text-soft">SDK setup and API key flow for connected services.</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onNavigate("Connect Project");
                  setDocsOpen(false);
                }}
              >
                Open
              </Button>
            </div>
          </DrawerPanel>
          <DrawerPanel>
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-amber" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">Service Catalog</h3>
                <p className="mt-1 text-sm text-text-soft">Inventory, connection status, and operational ownership.</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onNavigate("Service Catalog");
                  setDocsOpen(false);
                }}
              >
                Open
              </Button>
            </div>
          </DrawerPanel>
          <DrawerPanel>
            <div className="flex items-start gap-3">
              <ExternalLink className="mt-0.5 h-5 w-5 text-white" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">OpenAPI</h3>
                <p className="mt-1 text-sm text-text-soft">Core API schema served by the running backend.</p>
              </div>
              <Button size="sm" onClick={() => window.open(`${coreApiUrl}/api/docs/openapi.json`, "_blank", "noopener,noreferrer")}>
                Open
              </Button>
            </div>
          </DrawerPanel>
        </div>
      </Drawer>

      <Drawer open={notificationsOpen} title="Notifications" onClose={() => setNotificationsOpen(false)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-text-soft">{notifications.length} recent notification events</p>
          <Button size="sm" icon={<RefreshCw className="h-4 w-4" />} loading={loadingNotifications} onClick={loadNotifications}>
            Refresh
          </Button>
        </div>
        <div className="grid gap-2">
          {notifications.length === 0 ? <DrawerPanel>No notification history found for the current workspace.</DrawerPanel> : null}
          {notifications.map((item) => (
            <DrawerPanel key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{item.subject}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {item.provider} to {item.destination}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-text-soft">{item.status}</span>
              </div>
            </DrawerPanel>
          ))}
        </div>
        <div className="mt-4">
          <Button
            variant="primary"
            onClick={() => {
              onNavigate("Notifications");
              setNotificationsOpen(false);
            }}
          >
            Open Notifications
          </Button>
        </div>
      </Drawer>
    </header>
  );
}

function ProfileAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm text-text-soft hover:bg-panel-hover hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}
