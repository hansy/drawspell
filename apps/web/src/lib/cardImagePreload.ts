import type { Card } from "@/types";

import { getDisplayImageUrl } from "@/lib/cardDisplay";

const loadedImageUrls = new Set<string>();
const pendingImages = new Map<string, HTMLImageElement>();

export const preloadCardPreviewImage = (
  card: Card,
  fetchPriority: "high" | "low" = "low",
) => {
  if (typeof Image === "undefined") return;

  const imageUrl = getDisplayImageUrl(card, { preferArtCrop: false });
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
