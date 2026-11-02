import ts from "typescript";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type CopyFinding = {
  file: string;
  line: number;
  kind: "text" | "attribute" | "property" | "notification";
  text: string;
};
export type CopyBaseline = { version: 1; entries: Record<string, number> };

const copyAttributes = new Set([
  "alt", "title", "placeholder", "aria-label", "aria-description",
  "label", "description", "emptyMessage", "loadingText", "confirmLabel", "cancelLabel",
  "subtitle", "heading", "tooltip", "helperText", "caption", "updatedAt", "content",
  "primaryActionLabel", "secondaryActionLabel", "submitLabel", "randomizeLabel", "pendingLabel",
]);
const copyProperties = new Set([
  "label", "title", "description", "message", "badge", "subtitle", "heading",
  "confirmLabel", "cancelLabel", "emptyMessage", "loadingText", "tooltip",
  "text", "caption", "hint", "helperText", "content", "subject", "gesture", "error",
]);
const isCopyProperty = (name: string) => copyProperties.has(name) || /(?:Label|Title|Description|Message|Text|Tooltip|Hint)$/.test(name);
const copySetters = new Set(["setMessage", "setError", "setStatusMessage", "setCopyMessage"]);

// Match human text in known presentation contexts, never arbitrary protocol strings.
const hasText = (text: string) => /\p{L}/u.test(text);
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

export function auditSource(file: string, source: string): CopyFinding[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings: CopyFinding[] = [];
  const recorded = new Set<number>();
  const add = (node: ts.Node, kind: CopyFinding["kind"], text: string) => {
    const value = normalize(text);
    // Addresses and machine-readable metadata are protocol data, not prose.
    if (/^(?:https?:\/\/|\/api\/|\$\{origins\.web\}\/|width=device-width|feedback@drawspell\.space$)/.test(value)) return;
    if (!hasText(value) || recorded.has(node.getStart(ast))) return;
    recorded.add(node.getStart(ast));
    findings.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, kind, text: value });
  };
  const display = (node: ts.Node | undefined, kind: CopyFinding["kind"]) => {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      add(node, kind, node.text);
    } else if (ts.isTemplateExpression(node)) {
      // Expressions are retained in the fingerprint: copy changes and variable changes need review.
      const staticText = node.head.text + node.templateSpans.map((span) => span.literal.text).join("");
      if (hasText(staticText)) add(node, kind, node.getText(ast).slice(1, -1));
      else node.templateSpans.forEach((span) => display(span.expression, kind));
    } else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
      display(node.expression, kind);
    } else if (ts.isConditionalExpression(node)) {
      display(node.whenTrue, kind);
      display(node.whenFalse, kind);
    } else if (ts.isBinaryExpression(node)) {
      if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(node.operatorToken.kind)) {
        display(node.left, kind);
        display(node.right, kind);
      } else if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        display(node.right, kind);
      }
    } else if (ts.isJsxExpression(node)) {
      display(node.expression, kind);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, "text", node.text);
    if (ts.isJsxAttribute(node) && (copyAttributes.has(node.name.getText(ast)) || isCopyProperty(node.name.getText(ast)))) {
      display(node.initializer, "attribute");
    }
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      display(node.expression, "text");
    }
    if (ts.isPropertyAssignment(node) && isCopyProperty(node.name.getText(ast).replace(/^["']|["']$/g, ""))) {
      const protocolMeta = node.name.getText(ast) === "content" && ts.isObjectLiteralExpression(node.parent) && node.parent.properties.some((property) =>
        ts.isPropertyAssignment(property) && property.name.getText(ast) === "name" &&
        ts.isStringLiteral(property.initializer) && ["viewport", "robots", "og:url", "og:image"].includes(property.initializer.text));
      const diagnostic = ts.isCallExpression(node.parent.parent) && node.parent.parent.expression.getText(ast) === "handoffDebugLog";
      if (!protocolMeta && !diagnostic) display(node.initializer, "property");
    }
    if ((ts.isVariableDeclaration(node) || ts.isBindingElement(node) || ts.isParameter(node)) &&
        ts.isIdentifier(node.name) && (isCopyProperty(node.name.text) || /(?:Label|Text|Message|Title|Description|Placeholder|Tooltip|Hint)$/.test(node.name.text))) {
      display(node.initializer, "property");
    }
    if (ts.isPropertyAssignment(node)) {
      let parent: ts.Node | undefined = node.parent;
      while (parent && !ts.isVariableDeclaration(parent) && !ts.isFunctionLike(parent)) parent = parent.parent;
      if (parent && ts.isVariableDeclaration(parent) && /^(?:ZONE_LABEL|MANA_NAMES|OUT_REASON_TEXT)$/.test(parent.name.getText(ast))) {
        display(node.initializer, "property");
      }
    }
    if (ts.isNewExpression(node) && node.expression.getText(ast) === "Error") display(node.arguments?.[0], "notification");
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.expression.getText(ast) === "m" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
        for (const property of node.arguments[0].properties) if (ts.isPropertyAssignment(property)) display(property.initializer, "text");
      }
      const isNotification = (ts.isIdentifier(callee) && (copySetters.has(callee.text) || callee.text === "toast")) ||
        (ts.isPropertyAccessExpression(callee) && (callee.expression.getText(ast) === "toast" || callee.expression.getText(ast).endsWith(".toast")));
      if (isNotification) display(node.arguments[0], "notification");
    }
    if (ts.isReturnStatement(node)) {
      let parent: ts.Node | undefined = node.parent;
      while (parent && !ts.isFunctionLike(parent)) parent = parent.parent;
      const name = parent && ts.isFunctionDeclaration(parent) ? parent.name?.text :
        parent && ts.isArrowFunction(parent) && ts.isVariableDeclaration(parent.parent) ? parent.parent.name.getText(ast) : "";
      if (name && !name.endsWith("ClassName") && /(?:Label|Name|Text|Message|Title|Description|Tooltip|Hint|Verb|Errors)$/.test(name)) display(node.expression, "text");
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings.sort((a, b) => a.line - b.line || a.text.localeCompare(b.text));
}

export function countFindings(findings: CopyFinding[]): CopyBaseline {
  const entries: Record<string, number> = {};
  for (const { file, kind, text } of findings) {
    const key = JSON.stringify([file, kind, text]);
    entries[key] = (entries[key] ?? 0) + 1;
  }
  return { version: 1, entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) };
}

export function compareBaseline(current: CopyBaseline, baseline: CopyBaseline) {
  return {
    added: Object.keys(current.entries).filter((key) => current.entries[key] > (baseline.entries[key] ?? 0)),
    removed: Object.keys(baseline.entries).filter((key) => baseline.entries[key] > (current.entries[key] ?? 0)),
  };
}

export async function auditDirectory(root: string): Promise<CopyFinding[]> {
  const walk = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    const groups = await Promise.all(entries.filter((entry) => !["__tests__", "test", "paraglide", "node_modules"].includes(entry.name)).map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.(gen|test|spec|d)\./.test(entry.name) ? [path] : [];
    }));
    return groups.flat();
  };
  const files = (await walk(resolve(root, "src"))).sort();
  const results = await Promise.all(files.map(async (file) => auditSource(relative(root, file).replaceAll("\\", "/"), await readFile(file, "utf8"))));
  return results.flat();
}

async function main() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const findings = await auditDirectory(root);
  const current = countFindings(findings);
  const mode = process.argv[2] ?? "--check";
  if (mode === "--report") {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }
  if (!["--check", "--prune"].includes(mode)) throw new Error("Use --check, --report, or --prune.");
  const baselinePath = resolve(root, "i18n/copy-baseline.json");
  const baseline: CopyBaseline = JSON.parse(await readFile(baselinePath, "utf8"));
  if (baseline.version !== 1) throw new Error("Unsupported copy audit baseline version.");
  const { added, removed } = compareBaseline(current, baseline);
  if (added.length) {
    for (const key of added) {
      const [file, kind, text] = JSON.parse(key);
      const match = findings.find((finding) => finding.file === file && finding.kind === kind && finding.text === text);
      console.error(`${file}:${match?.line ?? 1}: New hardcoded ${kind}: ${text}`);
    }
    throw new Error("Put new user-facing copy in translation messages. The baseline may only shrink; see docs/features/internationalization.md.");
  }
  if (removed.length && mode === "--prune") {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  } else if (removed.length) {
    throw new Error("Copy migration removed baseline entries. Run bun run i18n:prune to ratchet the baseline down.");
  }
  console.log(`Copy audit passed: ${findings.length} existing occurrences in ${new Set(findings.map(({ file }) => file)).size} files; no new hardcoded copy.`);
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
