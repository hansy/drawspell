import { describe, expect, it } from "vitest";
import { parseCatalog, validateCatalogs } from "./catalog-check";

const good = () => ({ en: { greeting: "Hello, {name}", close: "Close" }, es: { greeting: "Hola, {name}", close: "Cerrar" } });
const check = (value: unknown) => validateCatalogs(value as Record<string, unknown>, ["en", "es"], "en");

describe("translation catalog gate", () => {
  it("accepts complete translations and reordered parameters", () => {
    expect(check(good())).toEqual([]);
    expect(check({ en: { greeting: "{first} {last}" }, es: { greeting: "{last}, {first}" } })).toEqual([]);
  });

  it("rejects missing locales, keys, and empty translations", () => {
    expect(check({ en: good().en }).join()).toContain("es: missing catalog");
    expect(check({ ...good(), es: { close: "Cerrar" } }).join()).toContain("es.greeting: missing translation");
    expect(check({ ...good(), es: { ...good().es, close: "  " } }).join()).toContain("non-empty");
  });

  it("rejects missing, unknown, and malformed placeholders", () => {
    for (const greeting of ["Hola", "Hola, {other}", "Hola, {name} {extra}", "Hola, {name"]) {
      expect(check({ ...good(), es: { ...good().es, greeting } })).not.toEqual([]);
    }
  });

  it("rejects English catalog copies, extra keys, unsupported variants, and unregistered locales", () => {
    expect(check({ en: good().en, es: good().en }).join()).toContain("untranslated copy");
    expect(check({ ...good(), es: { ...good().es, extra: "Más" } }).join()).toContain("unknown message");
    expect(check({ ...good(), es: { ...good().es, greeting: [] } }).join()).toContain("non-empty message string");
    expect(check({ ...good(), xx: good().es }).join()).toContain("unexpected catalog");
  });

  it("rejects duplicate JSON keys before JSON.parse can silently overwrite them", () => {
    expect(() => parseCatalog('{"close":"Cerrar","close":"Close"}', "es.json")).toThrow("duplicate");
    expect(() => parseCatalog('{"close":', "es.json")).toThrow();
  });
});
