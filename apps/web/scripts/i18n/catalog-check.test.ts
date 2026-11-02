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

it("validates declared inputs and locale-specific plural categories", () => {
  const plural = (other = "{count} cards") => [{
    declarations: ["input count", "local countPlural = count: plural"],
    selectors: ["countPlural"],
    match: { "countPlural=one": "{count} card", "countPlural=other": other },
  }];
  expect(validateCatalogs({ en: { cards: plural() }, de: { cards: plural("{count} Karten") } }, ["en", "de"], "en")).toEqual([]);
  expect(validateCatalogs({ en: { cards: plural() }, ru: { cards: plural("{count} карт") } }, ["en", "ru"], "en").join()).toContain("missing plural category few");
  expect(check({ en: { cards: plural() }, es: { cards: [{ match: { "count=*": "{other} cartas" } }] } }).join()).toContain("placeholders must match");
});


it("invalidates target translations when existing English copy changes", async () => {
  const { sourceRevision, validateRevisions } = await import("./revisions");
  const source = { greeting: "Hello" };
  const revisions = { es: { greeting: sourceRevision(source.greeting) }, fr: { greeting: sourceRevision(source.greeting) } };
  expect(validateRevisions(source, revisions, ["es", "fr"])).toEqual([]);
  expect(validateRevisions({ greeting: "Welcome" }, revisions, ["es", "fr"])).toHaveLength(2);
  revisions.es.greeting = sourceRevision("Welcome");
  expect(validateRevisions({ greeting: "Welcome" }, revisions, ["es", "fr"])).toEqual([
    "fr.greeting: translation needs updating for the current English source",
  ]);
});


it("rejects translations of API syntax and fixed keyboard bindings", () => {
  const source = { ...good().en, create_room_docs_application_json: "application/json", sidenav_view_ctrl_z: "Ctrl/⌘ Z" };
  const translated = { ...good().es, create_room_docs_application_json: "application/json", sidenav_view_ctrl_z: "Ctrl/⌘ Z" };
  expect(check({ en: source, es: translated })).toEqual([]);
  expect(check({ en: source, es: { ...translated, create_room_docs_application_json: "aplicación/json" } }).join()).toContain("protocol syntax");
  expect(check({ en: source, es: { ...translated, sidenav_view_ctrl_z: "Ctrl/⌘ Y" } }).join()).toContain("key bindings");
});
