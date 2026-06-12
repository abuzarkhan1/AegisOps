import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  configureApiAuth,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
  type AuthSessionRecord,
  type AuthUserRecord
} from "../shared/api/core";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type StoredSession = {
  user: AuthUserRecord;
  accessToken: string;
  refreshToken?: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user?: AuthUserRecord;
  accessToken?: string;
  refreshToken?: string;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; name?: string; organizationName?: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const storageKey = "aegisops:auth-session";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredSession(): StoredSession | undefined {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.accessToken && parsed.user ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function persistSession(session?: StoredSession) {
  if (!session) {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

function normalizeSession(session: AuthSessionRecord | StoredSession): StoredSession {
  return {
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | undefined>(() => readStoredSession());
  const [status, setStatus] = useState<AuthStatus>(() => (readStoredSession() ? "loading" : "anonymous"));
  const sessionRef = useRef<StoredSession | undefined>(session);

  const applySession = useCallback((nextSession?: StoredSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    persistSession(nextSession);
    setStatus(nextSession ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => sessionRef.current?.accessToken,
      onUnauthorized: () => applySession(undefined)
    });
  }, [applySession]);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current?.accessToken) {
      setStatus("anonymous");
      return;
    }
    const activeSession: StoredSession = current;

    let cancelled = false;
    async function verify() {
      setStatus("loading");
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) applySession({ ...activeSession, user });
      } catch {
        if (!activeSession.refreshToken) {
          if (!cancelled) applySession(undefined);
          return;
        }
        try {
          const refreshed = await refreshSession(activeSession.refreshToken);
          if (!cancelled) {
            applySession({
              user: refreshed.user,
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken ?? activeSession.refreshToken
            });
          }
        } catch {
          if (!cancelled) applySession(undefined);
        }
      }
    }
    verify();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user,
      accessToken: session?.accessToken,
      refreshToken: session?.refreshToken,
      login: async (payload) => {
        const next = await loginRequest(payload);
        applySession(normalizeSession(next));
      },
      register: async (payload) => {
        const next = await registerRequest(payload);
        applySession(normalizeSession(next));
      },
      logout: async () => {
        const token = sessionRef.current?.refreshToken;
        applySession(undefined);
        await logoutRequest(token).catch(() => undefined);
      }
    }),
    [applySession, session?.accessToken, session?.refreshToken, session?.user, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
