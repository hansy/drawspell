import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { validateRevisions, type TranslationRevisions } from "./revisions";
import { baseLocale, locales } from "../../src/i18n/locales";

type Catalogs = Record<string, unknown>;
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

// Displayed syntax and key bindings must remain usable when surrounding prose is translated.
const protocolMessageIds = new Set([
  "create_room_docs_post", "create_room_docs_application_json", "create_room_docs_externalid",
  "create_room_docs_idempotency_replayed_true", "create_room_docs_retry_after",
  "docs_authorization", "docs_authorization_2", "docs_bearer_your_api_key",
  "sidenav_view_c", "sidenav_view_r", "sidenav_view_ctrl_z", "turn_menu_space",
]);

/** Catalog coverage complements Paraglide compilation and the inlang semantic checker. */
export function validateCatalogs(catalogs: Catalogs, expectedLocales: readonly string[], sourceLocale: string): string[] {
  const errors: string[] = [];
  const source = catalogs[sourceLocale];
  if (!isObject(source)) return [`${sourceLocale}: missing source catalog`];
  const keys = Object.keys(source).filter((key) => key !== "$schema");
  if (!keys.length) errors.push(`${sourceLocale}: source catalog is empty`);

  const variables = (value: unknown, location: string, locale: string): Set<string> | null => {
    const names = new Set<string>();
    const pattern = (text: unknown) => {
      if (typeof text !== "string" || !text.trim()) {
        errors.push(`${location}: expected a non-empty message string`);
        return;
      }
      const rest = text.replace(/\{([a-zA-Z_][\w]*)(?::[^{}]+)?\}/g, (_match, name: string) => {
        names.add(name);
        return "";
      });
      if (/[{}]/.test(rest)) errors.push(`${location}: invalid placeholder syntax`);
    };
    if (typeof value === "string") {
      pattern(value);
      return names;
    }
    if (!Array.isArray(value) || value.length !== 1 || !isObject(value[0]) || !isObject(value[0].match) || !Object.keys(value[0].match).length) {
      errors.push(`${location}: expected a non-empty message string or variant`);
      return null;
    }
    const variant = value[0];
    for (const text of Object.values(variant.match as Record<string, unknown>)) pattern(text);
    const inputs = new Set<string>();
    const declarations = Array.isArray(variant.declarations) ? variant.declarations : [];
    for (const declaration of declarations) {
      if (typeof declaration !== "string") continue;
      const input = /^input (\w+)$/.exec(declaration);
      if (input) inputs.add(input[1]);
      const plural = /^local (\w+) = \w+: plural(?: |$)/.exec(declaration);
      if (plural) {
        const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
        for (const category of categories) {
          if (!Object.keys(variant.match as object).some((key) => key.split(/,\s*/).includes(`${plural[1]}=${category}`) || key.split(/,\s*/).includes(`${plural[1]}=*`))) {
            errors.push(`${location}: missing plural category ${category}`);
          }
        }
      }
    }
    return declarations.length ? inputs : names;
  };

  const sourceVariables = new Map(keys.map((key) => [key, variables(source[key], `${sourceLocale}.${key}`, sourceLocale)]));
  for (const locale of expectedLocales) {
    const catalog = catalogs[locale];
    if (!isObject(catalog)) {
      errors.push(`${locale}: missing catalog`);
      continue;
    }
    for (const key of keys) {
      if (!/^[a-z][a-z0-9_]*$/.test(key)) errors.push(`${sourceLocale}.${key}: use a stable snake_case message ID`);
      if (!Object.hasOwn(catalog, key)) {
        errors.push(`${locale}.${key}: missing translation`);
        continue;
      }
      if (protocolMessageIds.has(key) && catalog[key] !== source[key]) {
        errors.push(`${locale}.${key}: protocol syntax and key bindings must match ${sourceLocale} exactly`);
      }
      const actual = locale === sourceLocale ? sourceVariables.get(key) : variables(catalog[key], `${locale}.${key}`, locale);
      const expected = sourceVariables.get(key);
      if (actual && expected && (actual.size !== expected.size || [...actual].some((name) => !expected.has(name)))) {
        errors.push(`${locale}.${key}: placeholders must match ${sourceLocale} (${[...expected].sort().join(", ")})`);
      }
    }
    for (const key of Object.keys(catalog)) {
      if (key !== "$schema" && !Object.hasOwn(source, key)) errors.push(`${locale}.${key}: unknown message`);
    }
    // Exact whole-catalog English copies must not masquerade as finished translations.
    // Individual equal messages can be legitimate (brands, "OK", etc.).
    if (locale !== sourceLocale && keys.length && keys.every((key) => JSON.stringify(catalog[key]) === JSON.stringify(source[key]))) {
      errors.push(`${locale}: catalog is an untranslated copy of ${sourceLocale}`);
    }
  }
  for (const locale of Object.keys(catalogs)) if (!expectedLocales.includes(locale)) errors.push(`${locale}: unexpected catalog`);
  return errors;
}

export function parseCatalog(text: string, file: string): unknown {
  // JSON.parse silently accepts duplicate IDs. Check them before parsing so lost messages fail CI.
  const ast = ts.parseJsonText(file, text);
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set<string>();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = ts.isStringLiteral(property.name) ? property.name.text : property.name.getText(ast);
        if (keys.has(key)) throw new Error(`${file}: duplicate message/property ${key}`);
        keys.add(key);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return JSON.parse(text);
}

async function main() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const settings = JSON.parse(await readFile(resolve(root, "project.inlang/settings.json"), "utf8"));
  if (settings.baseLocale !== baseLocale || JSON.stringify(settings.locales) !== JSON.stringify(locales)) {
    throw new Error("project.inlang locales must match src/i18n/locales.ts exactly");
  }
  const files = (await readdir(resolve(root, "messages"))).filter((file) => file.endsWith(".json"));
  const catalogs = Object.fromEntries(await Promise.all(files.map(async (file) => [
    file.slice(0, -5), parseCatalog(await readFile(resolve(root, "messages", file), "utf8"), file),
  ])));
  const errors = validateCatalogs(catalogs, locales, baseLocale);
  const revisions = JSON.parse(await readFile(resolve(root, "i18n/translation-revisions.json"), "utf8")) as TranslationRevisions;
  errors.push(...validateRevisions(catalogs.en as Record<string, unknown>, revisions, locales.filter((locale) => locale !== baseLocale)));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Catalog coverage passed: ${Object.keys(catalogs.en as object).filter((key) => key !== "$schema").length} messages in ${locales.length} languages.`);
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
