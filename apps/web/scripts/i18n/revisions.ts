import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseLocale, locales } from "../../src/i18n/locales";

/** Records which English revision each translation was written against, not linguistic approval. */
export type TranslationRevisions = Record<string, Record<string, string>>;
export const sourceRevision = (message: unknown) =>
  createHash("sha256").update(JSON.stringify(message)).digest("hex").slice(0, 16);

export function validateRevisions(source: Record<string, unknown>, revisions: TranslationRevisions, targets: readonly string[]) {
  const errors: string[] = [];
  for (const locale of targets) {
    for (const [id, message] of Object.entries(source)) {
      if (id !== "$schema" && revisions[locale]?.[id] !== sourceRevision(message)) {
        errors.push(`${locale}.${id}: translation needs updating for the current English source`);
      }
    }
    for (const id of Object.keys(revisions[locale] ?? {})) {
      if (!Object.hasOwn(source, id)) errors.push(`${locale}.${id}: remove the obsolete translation revision`);
    }
  }
  for (const locale of Object.keys(revisions)) {
    if (!targets.includes(locale)) errors.push(`${locale}: remove the unregistered translation revision`);
  }
  return errors;
}

if (import.meta.main) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const args = process.argv.slice(2);
  const locale = args[args.indexOf("--locale") + 1];
  const id = args.includes("--message") ? args[args.indexOf("--message") + 1] : undefined;
  const targets = locales.filter((value) => value !== baseLocale && (args.includes("--all") || value === locale));
  if (!targets.length) throw new Error("Use --locale es [--message message_id], or --all after updating every translation.");
  const source = JSON.parse(await readFile(resolve(root, "messages/en.json"), "utf8"));
  if (id && !Object.hasOwn(source, id)) throw new Error(`Unknown message: ${id}`);
  const path = resolve(root, "i18n/translation-revisions.json");
  const revisions: TranslationRevisions = await readFile(path, "utf8").then(JSON.parse).catch((error) => {
    if (error.code === "ENOENT") return {};
    throw error;
  });
  for (const target of targets) {
    const catalog = JSON.parse(await readFile(resolve(root, `messages/${target}.json`), "utf8"));
    const records = id ? revisions[target] ?? {} : {};
    for (const [key, message] of Object.entries(source)) {
      if (key === "$schema" || (id && key !== id)) continue;
      if (!Object.hasOwn(catalog, key)) throw new Error(`${target}.${key}: missing translation`);
      records[key] = sourceRevision(message);
    }
    revisions[target] = records;
  }
  await writeFile(path, `${JSON.stringify(revisions, null, 2)}\n`);
  console.log(`Recorded current source revisions for ${targets.join(", ")}. Translation quality still requires review.`);
}
