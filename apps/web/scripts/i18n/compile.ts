import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { compile } from "@inlang/paraglide-js";
import { paraglideOptions } from "../../paraglide.config";

// Seed the public incremental compiler API from the files actually on disk,
// as Paraglide's Vite plugin does. An unchanged test/typecheck command must not
// delete the generated directory underneath a running dev server or SSR reader.
// Hash format follows the pinned compiler's output hash (contents + absolute path).
const outdir = resolve(paraglideOptions.outdir);
const files = await readdir(outdir, { recursive: true }).catch((error) => {
  if (error.code === "ENOENT") return [];
  throw error;
});
const entries = await Promise.all(files.map(async (file) => {
  const path = resolve(outdir, file);
  try {
    const contents = await readFile(path, "utf8");
    return [file, createHash("sha256").update(contents + path).digest("hex")] as const;
  } catch (error) {
    if (["EISDIR", "ENOENT"].includes((error as NodeJS.ErrnoException).code ?? "")) return null;
    throw error;
  }
}));
await compile({
  ...paraglideOptions,
  previousCompilation: { outputHashes: Object.fromEntries(entries.filter((entry) => entry !== null)) },
});
