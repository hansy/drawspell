import { describe, expect, it } from "vitest";

import type { PermissionResult } from "../../types";
import {
  ensureActorMatches,
  ensurePermission,
  readActorId,
  readPayload,
  requireArrayProp,
  requireNonEmptyString,
  requireNonEmptyStringProp,
  requireRecordProp,
  requireString,
  requireStringProp,
} from "../validation";

describe("intent validation helpers", () => {
  it("normalizes payloads to records", () => {
    expect(readPayload(null)).toEqual({});
    expect(readPayload("nope")).toEqual({});
    expect(readPayload({ ok: true })).toEqual({ ok: true });
  });

  it("reads actor ids as non-empty strings", () => {
    expect(readActorId({ actorId: "p1" })).toBe("p1");
    expect(readActorId({ actorId: "" })).toBeUndefined();
    expect(readActorId({})).toBeUndefined();
  });

  it("distinguishes string vs non-empty string requirements", () => {
    expect(requireString("", "bad")).toEqual({ ok: true, value: "" });
    expect(requireNonEmptyString("", "bad")).toEqual({ ok: false, error: "bad" });
  });

  it("reuses the same validation rules for payload properties", () => {
    expect(requireStringProp({ label: "" }, "label", "bad")).toEqual({
      ok: true,
      value: "",
    });
    expect(requireNonEmptyStringProp({ label: "" }, "label", "bad")).toEqual({
      ok: false,
      error: "bad",
    });
    expect(requireRecordProp({ meta: { ok: true } }, "meta", "bad")).toEqual({
      ok: true,
      value: { ok: true },
    });
    expect(requireArrayProp({ ids: ["a"] }, "ids", "bad")).toEqual({
      ok: true,
      value: ["a"],
    });
    expect(requireArrayProp({ ids: "a" }, "ids", "bad")).toEqual({
      ok: false,
      error: "bad",
    });
  });

  it("surfaces permission reasons and fallbacks", () => {
    expect(ensurePermission({ allowed: true })).toEqual({ ok: true });
    expect(ensurePermission({ allowed: false, reason: "nope" })).toEqual({
      ok: false,
      error: "nope",
    });
    const withoutReason = { allowed: false } as PermissionResult;
    expect(ensurePermission(withoutReason)).toEqual({ ok: false, error: "not permitted" });
  });

  it("returns actor mismatch errors by default", () => {
    expect(ensureActorMatches("p1", "p1")).toEqual({ ok: true });
    expect(ensureActorMatches("p1", "p2")).toEqual({ ok: false, error: "actor mismatch" });
  });
});
