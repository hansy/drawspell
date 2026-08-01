export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const readBenchNumberArg = (name: string) => {
  const idx = process.argv.findIndex((arg) => arg === `--${name}`);
  if (idx === -1) return null;
  const raw = process.argv[idx + 1];
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

export const withBenchNumberArg = <T extends number>(
  key: string,
  fallback: T
): T => {
  const value = readBenchNumberArg(key);
  return (value ?? fallback) as T;
};
