import { HttpError } from "./errors";
import type {
  AlertOperator,
  IncidentSeverity,
  IncidentStatus,
  Organization,
  Project,
  ServiceRecord,
  ServiceType,
  UserRole
} from "../../modules/platform/types/platform.types";

export const requiredString = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${key} is required`);
  }
  return value.trim();
};

export const optionalString = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

export const optionalObject = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
};

export const optionalNumber = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new HttpError(400, `${key} must be a number`);
  }
  return numberValue;
};

export const userRole = (value: unknown): UserRole => {
  if (value === "owner" || value === "admin" || value === "engineer" || value === "viewer") return value;
  return "engineer";
};

export const severity = (value: unknown): IncidentSeverity => {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") return value;
  return "medium";
};

export const incidentStatus = (value: unknown): IncidentStatus | undefined => {
  if (
    value === "open" ||
    value === "investigating" ||
    value === "identified" ||
    value === "monitoring" ||
    value === "resolved" ||
    value === "closed"
  ) {
    return value;
  }
  return undefined;
};

export const alertOperator = (value: unknown): AlertOperator => {
  const aliases: Record<string, AlertOperator> = {
    ">": "gt",
    "<": "lt",
    ">=": "gte",
    "<=": "lte",
    "==": "eq",
    "=": "eq",
    gt: "gt",
    lt: "lt",
    gte: "gte",
    lte: "lte",
    eq: "eq"
  };
  return typeof value === "string" && aliases[value] ? aliases[value] : "gt";
};

export const healthStatus = (value: unknown): ServiceRecord["healthStatus"] | undefined => {
  if (value === "healthy" || value === "degraded" || value === "down" || value === "unknown") return value;
  return undefined;
};

export const serviceType = (value: unknown): ServiceType | undefined => {
  if (
    value === "api" ||
    value === "frontend" ||
    value === "worker" ||
    value === "database" ||
    value === "db" ||
    value === "queue" ||
    value === "cache" ||
    value === "message-broker" ||
    value === "external-api" ||
    value === "external"
  ) {
    return value;
  }
  return undefined;
};

export const projectType = (value: unknown): Project["projectType"] | undefined => {
  if (
    value === "monolith" ||
    value === "microservices" ||
    value === "worker-queue" ||
    value === "frontend" ||
    value === "hybrid"
  ) {
    return value;
  }
  return undefined;
};

export const organizationPlan = (value: unknown): Organization["plan"] | undefined => {
  if (value === "free" || value === "pro" || value === "enterprise") return value;
  return undefined;
};

export const optionalBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};
