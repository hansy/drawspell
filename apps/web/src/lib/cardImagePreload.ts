import type { Card } from "@/types";

import type { AppLocale } from "@/i18n/locales";
import { getLocalizedCard, peekLocalizedCard } from "@/services/scryfall/localizedCards";
import { localizedCardPresentation } from "@/services/scryfall/localizedPresentation";
import { peekCachedCard } from "@/services/scryfall/scryfallCache";
import { getCurrentFaceIndex } from "@/lib/cardDisplay";

import { getDisplayImageUrl } from "@/lib/cardDisplay";

const loadedImageUrls = new Set<string>();
const pendingImages = new Map<string, HTMLImageElement>();

export const preloadCardPreviewImage = (
  card: Card,
  fetchPriority: "high" | "low" = "low",
  viewer?: { locale: AppLocale; canSeeIdentity: boolean },
) => {
  if (typeof Image === "undefined" || viewer?.canSeeIdentity === false) return;
  const original = card.scryfallId ? peekCachedCard(card.scryfallId) : null;
  const translated = card.scryfallId && viewer ? peekLocalizedCard(card.scryfallId, viewer.locale) : null;
  const imageUrl = original && translated
    ? localizedCardPresentation(original, translated, getCurrentFaceIndex(card)).imageUris.normal
    : getDisplayImageUrl(card, { preferArtCrop: false });
  preloadImageUrl(imageUrl, fetchPriority);
  if (viewer && card.scryfallId && !translated && viewer.locale !== "en") {
    void getLocalizedCard(card.scryfallId, viewer.locale).then((result) => {
      if (!result.original || !result.card) return;
      preloadImageUrl(localizedCardPresentation(result.original, result.card, getCurrentFaceIndex(card)).imageUris.normal, fetchPriority);
    }).catch(() => undefined);
  }
};

const preloadImageUrl = (imageUrl: string | undefined, fetchPriority: "high" | "low") => {
  if (!imageUrl || loadedImageUrls.has(imageUrl)) return;

  const pendingImage = pendingImages.get(imageUrl);
  if (pendingImage) {
    if (fetchPriority === "high") pendingImage.fetchPriority = "high";
    return;
  }

  const image = new Image();
  pendingImages.set(imageUrl, image);
  image.decoding = "async";
  image.fetchPriority = fetchPriority;
  image.addEventListener(
    "load",
    () => {
      pendingImages.delete(imageUrl);
      loadedImageUrls.add(imageUrl);
    },
    { once: true },
  );
  image.addEventListener(
    "error",
    () => {
      pendingImages.delete(imageUrl);
    },
    { once: true },
  );
  image.src = imageUrl;
};
