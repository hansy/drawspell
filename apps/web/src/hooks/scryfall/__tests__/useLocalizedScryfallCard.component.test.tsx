import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppLocale } from "@/i18n/locales";
import type { ScryfallCard } from "@/types/scryfall";
import { getLocalizedCard } from "@/services/scryfall/localizedCards";
import { useLocalizedScryfallCard } from "../useLocalizedScryfallCard";

vi.mock("@/services/scryfall/localizedCards", () => ({ getLocalizedCard: vi.fn() }));
const load = vi.mocked(getLocalizedCard);
const original = { id: "canonical", name: "Card", lang: "en" } as ScryfallCard;
const result = (lang: string) => ({ card: { ...original, id: `printing-${lang}`, lang }, original, errors: [] });

describe("viewer-local Scryfall hook", () => {
  beforeEach(() => load.mockReset());

  it("never fetches a hidden card identity and clears data immediately when permission changes", async () => {
    load.mockResolvedValue(result("fr"));
    const { result: hook, rerender } = renderHook(({ visible }) => useLocalizedScryfallCard("canonical", "fr", visible), { initialProps: { visible: false } });
    expect(load).not.toHaveBeenCalled();
    expect(hook.current.data).toBeNull();
    rerender({ visible: true });
    await waitFor(() => expect(hook.current.data?.lang).toBe("fr"));
    rerender({ visible: false });
    expect(hook.current.data).toBeNull();
    expect(hook.current.original).toBeNull();
    expect(hook.current.isLoading).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("ignores late responses from an earlier language and keeps canonical data separate", async () => {
    let finishFrench!: (value: ReturnType<typeof result>) => void;
    load.mockImplementationOnce(() => new Promise((resolve) => { finishFrench = resolve; }));
    load.mockResolvedValueOnce(result("ja"));
    const { result: hook, rerender } = renderHook(({ locale }: { locale: AppLocale }) => useLocalizedScryfallCard("canonical", locale, true), { initialProps: { locale: "fr" as AppLocale } });
    rerender({ locale: "ja" });
    await waitFor(() => expect(hook.current.data?.lang).toBe("ja"));
    await act(async () => finishFrench(result("fr")));
    expect(hook.current.data?.lang).toBe("ja");
    expect(hook.current.original).toBe(original);
  });

  it("supports two viewers using different locales without changing canonical identity", async () => {
    load.mockImplementation(async (_id, locale) => result(locale));
    const french = renderHook(() => useLocalizedScryfallCard("canonical", "fr", true));
    const german = renderHook(() => useLocalizedScryfallCard("canonical", "de", true));
    await waitFor(() => expect(french.result.current.data?.lang).toBe("fr"));
    await waitFor(() => expect(german.result.current.data?.lang).toBe("de"));
    expect(original).toMatchObject({ id: "canonical", name: "Card", lang: "en" });
    expect(french.result.current.original).toBe(german.result.current.original);
  });
});
