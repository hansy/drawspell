export type CardPreviewLockRequest = {
  cardId: string;
  anchorEl?: HTMLElement | null;
};

type CardPreviewLockHandler = (request: CardPreviewLockRequest) => void;

let handler: CardPreviewLockHandler | null = null;
const lockedPreviewDismissalEvents = new WeakSet<Event>();

export const setCardPreviewLockHandler = (next: CardPreviewLockHandler | null) => {
  handler = next;
};

export const requestCardPreviewLock = (request: CardPreviewLockRequest) => {
  if (!handler) return;
  handler(request);
};

export const markLockedPreviewDismissal = (event: Event) => {
  lockedPreviewDismissalEvents.add(event);
};

export const isLockedPreviewDismissal = (event: Event) =>
  lockedPreviewDismissalEvents.has(event);
