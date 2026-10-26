export const readArg = (name: string) => {
  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
};

export const hasArg = (name: string) => process.argv.includes(`--${name}`);
