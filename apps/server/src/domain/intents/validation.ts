import { isRecord } from "../yjsStore";
import type { InnerApplyResult, PermissionResult } from "../types";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const valid = <T>(value: T): ValidationResult<T> => ({ ok: true, value });
const invalid = <T>(error: string): ValidationResult<T> => ({ ok: false, error });
const innerOk = (): InnerApplyResult => ({ ok: true });
const innerError = (error: string): InnerApplyResult => ({ ok: false, error });

export const readPayload = (payload: unknown): Record<string, unknown> =>
  isRecord(payload) ? (payload as Record<string, unknown>) : {};

export const isString = (value: unknown): value is string => typeof value === "string";
export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export const readString = (value: unknown): string | undefined =>
  isString(value) ? value : undefined;
export const readNonEmptyString = (value: unknown): string | undefined =>
  isNonEmptyString(value) ? value : undefined;
export const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;
export const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;
export const readRecordValue = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) ? (value as Record<string, unknown>) : undefined;

export const readActorId = (payload: Record<string, unknown>): string | undefined =>
  readNonEmptyString(payload.actorId);

export const requireString = (value: unknown, error: string): ValidationResult<string> => {
  if (!isString(value)) return invalid(error);
  return valid(value);
};

export const requireNonEmptyString = (
  value: unknown,
  error: string
): ValidationResult<string> => {
  if (!isNonEmptyString(value)) return invalid(error);
  return valid(value);
};

export const requireRecord = (
  value: unknown,
  error: string
): ValidationResult<Record<string, unknown>> => {
  if (!isRecord(value)) return invalid(error);
  return valid(value as Record<string, unknown>);
};

export const requireArray = <T = unknown>(
  value: unknown,
  error: string
): ValidationResult<T[]> => {
  if (!Array.isArray(value)) return invalid(error);
  return valid(value as T[]);
};

const requireProp = <T>(
  payload: Record<string, unknown>,
  key: string,
  error: string,
  reader: (value: unknown, error: string) => ValidationResult<T>
): ValidationResult<T> => reader(payload[key], error);

export const requireStringProp = (
  payload: Record<string, unknown>,
  key: string,
  error: string
): ValidationResult<string> => requireProp(payload, key, error, requireString);

export const requireNonEmptyStringProp = (
  payload: Record<string, unknown>,
  key: string,
  error: string
): ValidationResult<string> => requireProp(payload, key, error, requireNonEmptyString);

export const requireRecordProp = (
  payload: Record<string, unknown>,
  key: string,
  error: string
): ValidationResult<Record<string, unknown>> =>
  requireProp(payload, key, error, requireRecord);

export const requireArrayProp = <T = unknown>(
  payload: Record<string, unknown>,
  key: string,
  error: string
): ValidationResult<T[]> => requireProp(payload, key, error, requireArray<T>);

export const ensureActorMatches = (
  actorId: string,
  expected: string,
  error = "actor mismatch"
): InnerApplyResult => {
  if (actorId !== expected) return innerError(error);
  return innerOk();
};

export const ensurePermission = (
  permission: PermissionResult,
  fallback = "not permitted"
): InnerApplyResult => {
  if (permission.allowed) return innerOk();
  return innerError(permission.reason ?? fallback);
};
