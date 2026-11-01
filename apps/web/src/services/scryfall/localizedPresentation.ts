import type { ScryfallCard, ScryfallCardFace } from "@/types/scryfall";

/** Read translated display fields without replacing current English Oracle rules or game stats. */
export function localizedCardPresentation(
  original: ScryfallCard,
  translated: ScryfallCard | null,
  faceIndex = 0,
) {
  const source = original.card_faces?.[faceIndex] ?? original;
  const localized = translated?.card_faces?.[faceIndex] ??
    (original.card_faces?.length ? null : translated);
  const field = (key: keyof Pick<ScryfallCardFace, "printed_name" | "printed_type_line" | "printed_text">) => localized?.[key] || source[key];
  return {
    name: field("printed_name") || source.name,
    typeLine: field("printed_type_line") || source.type_line,
    printedText: field("printed_text") || source.oracle_text,
    oracleText: source.oracle_text,
    imageUris: { ...original.image_uris, ...translated?.image_uris, ...source.image_uris, ...localized?.image_uris },
  };
}
