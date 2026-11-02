/**
 * Minimal Scryfall card data for Yjs sync
 *
 * This is a stripped-down version of ScryfallCard that only contains
 * fields needed for in-game card display. Full card data is fetched
 * on-demand and cached locally via IndexedDB.
 *
 * Size comparison (typical card):
 * - Full ScryfallCard: ~2-5KB
 * - ScryfallCardLite: ~200-500 bytes
 *
 * For a 100-card deck: ~300KB → ~30KB
 */

import type { ScryfallCard, ScryfallLayout } from "./scryfall";

/**
 * Minimal image URIs - only what's needed for display
 */
export interface ScryfallImageUrisLite {
  normal?: string;
  art_crop?: string;
}

/**
 * Minimal card face - only what's needed for DFC display
 */
export interface ScryfallCardFaceLite {
  name: string;
  printed_name?: string;
  printed_type_line?: string;
  printed_text?: string;
  image_uris?: ScryfallImageUrisLite;
  power?: string;
  toughness?: string;
}

/**
 * Minimal Scryfall card for sync
 * Contains only what's needed for in-game card rendering
 */
export interface ScryfallCardLite {
  id: string;
  layout: ScryfallLayout;
  printed_name?: string;
  printed_type_line?: string;
  printed_text?: string;
  cmc?: number; // Mana value - useful for grouping
  image_uris?: ScryfallImageUrisLite;
  card_faces?: ScryfallCardFaceLite[];
}

/**
 * Convert a full ScryfallCard to the lite version for sync
 */
export const toScryfallCardLite = (
  card: ScryfallCard
): ScryfallCardLite => {
  const lite: ScryfallCardLite = {
    id: card.id,
    layout: card.layout,
    ...(card.printed_name ? { printed_name: card.printed_name } : {}),
    ...(card.printed_type_line ? { printed_type_line: card.printed_type_line } : {}),
    ...(card.printed_text ? { printed_text: card.printed_text } : {}),
  };

  // Include CMC if present (useful for grouping)
  if (card.cmc !== undefined) {
    lite.cmc = card.cmc;
  }

  // Only include image_uris if present
  if (card.image_uris) {
    lite.image_uris = {
      normal: card.image_uris.normal,
      art_crop: card.image_uris.art_crop,
    };
  }

  // Only include card_faces if present and has multiple faces
  if (card.card_faces && card.card_faces.length > 0) {
    lite.card_faces = card.card_faces.map((face) => {
      const liteFace: ScryfallCardFaceLite = {
        name: face.name,
        ...(face.printed_name ? { printed_name: face.printed_name } : {}),
        ...(face.printed_type_line ? { printed_type_line: face.printed_type_line } : {}),
        ...(face.printed_text ? { printed_text: face.printed_text } : {}),
      };

      if (face.image_uris) {
        liteFace.image_uris = {
          normal: face.image_uris.normal,
          art_crop: face.image_uris.art_crop,
        };
      }

      if (face.power !== undefined) liteFace.power = face.power;
      if (face.toughness !== undefined) liteFace.toughness = face.toughness;

      return liteFace;
    });
  }

  return lite;
};

/**
 * Check if a card has the full Scryfall data or just lite
 */
export const isFullScryfallCard = (
  card: unknown
): card is ScryfallCard => {
  // Full cards have type_line, lite cards don't
  return (
    typeof card === "object" &&
    card !== null &&
    "type_line" in card &&
    "color_identity" in card
  );
};
