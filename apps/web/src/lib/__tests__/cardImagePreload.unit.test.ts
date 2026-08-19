import { afterEach, describe, expect, it, vi } from "vitest";

import type { Card } from "@/types";
import { preloadCardPreviewImage } from "../cardImagePreload";

const buildCard = (id: string, imageUrl: string): Card =>
  ({
    id,
    name: id,
    imageUrl,
    ownerId: "me",
    controllerId: "me",
    zoneId: "library",
    tapped: false,
    faceDown: false,
    position: { x: 0, y: 0 },
    rotation: 0,
    counters: [],
  }) as Card;

describe("preloadCardPreviewImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("deduplicates pending requests and upgrades their priority", () => {
    const images: Array<{
      decoding: string;
      fetchPriority: string;
      src: string;
    }> = [];

    class FakeImage {
      decoding = "auto";
      fetchPriority = "auto";
      src = "";

      constructor() {
        images.push(this);
      }

      addEventListener() {}
    }
    vi.stubGlobal("Image", FakeImage);

    const card = buildCard("preview-priority", "https://example.com/card.jpg");
    preloadCardPreviewImage(card);
    preloadCardPreviewImage(card, "high");

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      decoding: "async",
      fetchPriority: "high",
      src: "https://example.com/card.jpg",
    });
  });
});
