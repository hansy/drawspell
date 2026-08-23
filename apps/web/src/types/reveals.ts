import type { PlayerId } from "./ids";

export type {
  HandRevealsToAll,
  LibraryRevealEntry,
  LibraryRevealsToAll,
  FaceDownRevealsToAll,
} from "@mtg/shared/types/reveals";

export type CardReveal = { toAll?: boolean; to?: PlayerId[] } | null;
