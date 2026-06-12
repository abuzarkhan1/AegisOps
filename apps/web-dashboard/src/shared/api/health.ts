export type HealthState = "loading" | "ok" | "degraded" | "offline";

export type HealthResult = {
  status: HealthState;
  detail: string;
};

export type HealthTarget = {
  name: string;
  url: string;
};

export async function fetchHealthTarget(target: HealthTarget, signal?: AbortSignal) {
  try {
    const response = await fetch(target.url, { signal });
    const body = await response.json();
    const status: HealthState = body.status === "ok" ? "ok" : "degraded";
    return [target.name, { status, detail: body.service ?? target.url }] as const;
  } catch (error) {
    return [
      target.name,
      {
        status: signal?.aborted ? "loading" : "offline",
        detail: error instanceof Error ? error.message : "unreachable"
      }
    ] as const;
  }
}
