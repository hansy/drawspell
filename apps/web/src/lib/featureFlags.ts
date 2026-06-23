const enabledValues = new Set(["1", "true", "yes", "on"]);

const readBooleanEnvFlag = (value: string | undefined): boolean =>
  value ? enabledValues.has(value.toLowerCase()) : false;

export const featureFlags = {
  curatedDecks: readBooleanEnvFlag(import.meta.env.VITE_ENABLE_CURATED_DECKS),
};
