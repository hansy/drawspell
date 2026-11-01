import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { baseLocale, locales } from "../../src/i18n/locales";

type Catalogs = Record<string, unknown>;
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Coverage and placeholder guard for the flat messages currently in this project.
 * Paraglide compilation and `inlang check` remain required for rich/variant syntax.
 */
export function validateCatalogs(catalogs: Catalogs, expectedLocales: readonly string[], sourceLocale: string): string[] {
  const errors: string[] = [];
  const source = catalogs[sourceLocale];
  if (!isObject(source)) return [`${sourceLocale}: missing source catalog`];
  const keys = Object.keys(source).filter((key) => key !== "$schema");
  if (!keys.length) errors.push(`${sourceLocale}: source catalog is empty`);

  const variables = (value: unknown, location: string): Set<string> | null => {
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`${location}: expected a non-empty message string`);
      return null;
    }
    const variables = new Set<string>();
    const rest = value.replace(/\{([a-zA-Z_][\w]*)\}/g, (_match, name: string) => {
      variables.add(name);
      return "";
    });
    if (/[{}]/.test(rest)) errors.push(`${location}: invalid placeholder or unsupported syntax; extend validation with inlang check before using variants/markup`);
    return variables;
  };

  const sourceVariables = new Map(keys.map((key) => [key, variables(source[key], `${sourceLocale}.${key}`)]));
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
      const actual = locale === sourceLocale ? sourceVariables.get(key) : variables(catalog[key], `${locale}.${key}`);
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
    if (locale !== sourceLocale && keys.length && keys.every((key) => catalog[key] === source[key])) {
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
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Catalog coverage passed: ${Object.keys(catalogs.en as object).filter((key) => key !== "$schema").length} messages in ${locales.length} languages.`);
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
