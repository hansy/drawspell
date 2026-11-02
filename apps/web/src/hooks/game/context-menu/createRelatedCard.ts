import { m } from "@/paraglide/messages.js";
import type { Card, GameState, PlayerId, ViewerRole } from "@/types";
import type { ScryfallCard, ScryfallRelatedCard } from "@/types/scryfall";

import { planRelatedBattlefieldCardCreation } from "./relatedCardCreation";

export type ToastLike = {
  success: (message: string) => void;
  error: (message: string) => void;
};

export type LoggerLike = Pick<Console, "error">;

type StoreLike = Pick<
  GameState,
  "zones" | "cards" | "players" | "addCard"
>;

export const createRelatedCardHandler = (params: {
  actorId: PlayerId;
  viewerRole?: ViewerRole;
  getState: () => StoreLike;
  toast: ToastLike;
  fetchScryfallCardByUri: (uri: string) => Promise<ScryfallCard>;
  createId: () => string;
  logger?: LoggerLike;
}) => {
  const logger = params.logger ?? console;

  return async (card: Card, related: ScryfallRelatedCard) => {
    const state = params.getState();
    const planned = await planRelatedBattlefieldCardCreation({
      sourceCard: card,
      related,
      actorId: params.actorId,
      viewerRole: params.viewerRole,
      zonesById: state.zones,
      cardsById: state.cards,
      fetchScryfallCardByUri: params.fetchScryfallCardByUri,
      createId: params.createId,
    });

    if (!planned.ok) {
      if (planned.reason === "permission_denied") {
        params.toast.error(
          planned.message ?? m.related_card_creation_not_allowed_to_create_related_card_here()
        );
      }

      if (planned.reason === "fetch_failed") {
        if (planned.error) {
          logger.error("Failed to fetch related card from Scryfall", planned.error);
        }
        params.toast.error(m.related_create_failed());
      }

      return;
    }

    state.addCard(planned.card);
    params.toast.success(
      m.related_created({ name: related.name, token: planned.card.isToken ? m.card_actions_token() : "" })
    );
  };
};
