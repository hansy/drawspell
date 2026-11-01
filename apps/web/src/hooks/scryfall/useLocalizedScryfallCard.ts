import { useEffect, useState } from "react";
import type { AppLocale } from "@/i18n/locales";
import { getLocalizedCard } from "@/services/scryfall/localizedCards";
import { formatScryfallErrors } from "@/services/scryfall/scryfallErrors";

type Result = Awaited<ReturnType<typeof getLocalizedCard>>;
type Snapshot = { id: string; locale: AppLocale; result: Result | null; error: Error | null };

/** Only visible identities may be supplied. Stale locale/permission responses never render. */
export function useLocalizedScryfallCard(
  id: string | undefined,
  locale: AppLocale,
  canSeeIdentity: boolean,
) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    if (!id || !canSeeIdentity) return;
    let cancelled = false;
    void getLocalizedCard(id, locale).then((result) => {
      if (cancelled) return;
      setSnapshot({
        id, locale, result,
        error: result.errors.length ? new Error(formatScryfallErrors(result.errors)) : null,
      });
    }).catch((error: unknown) => {
      if (!cancelled) setSnapshot({ id, locale, result: null, error: error instanceof Error ? error : new Error(String(error)) });
    });
    return () => { cancelled = true; };
  }, [id, locale, canSeeIdentity]);

  const visible = Boolean(id && canSeeIdentity);
  const current = visible && snapshot?.id === id && snapshot?.locale === locale ? snapshot : null;
  return {
    data: current?.result?.card ?? null,
    original: current?.result?.original ?? null,
    isLoading: visible && !current,
    error: current?.error ?? null,
  };
}
