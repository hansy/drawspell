const uniqueMemberSetOrNull = (list: readonly string[]) => {
  const members = new Set(list);
  return members.size === list.length ? members : null;
};

export const hasSameMembers = (
  left: readonly string[],
  right: readonly string[]
): boolean => {
  if (left.length !== right.length) return false;
  const leftMembers = uniqueMemberSetOrNull(left);
  const rightMembers = uniqueMemberSetOrNull(right);
  if (!leftMembers || !rightMembers) return false;
  for (const entry of leftMembers) {
    if (!rightMembers.has(entry)) return false;
  }
  return true;
};

export const removeFromArray = (list: readonly string[], id: string) =>
  list.filter((value) => value !== id);

export const placeCardId = (
  list: readonly string[],
  cardId: string,
  placement: "top" | "bottom"
) => {
  const without = removeFromArray(list, cardId);
  if (placement === "bottom") return [cardId, ...without];
  return [...without, cardId];
};

export const placeCardIdFromTop = (
  list: readonly string[],
  cardId: string,
  requestedPosition: number,
) => {
  const without = removeFromArray(list, cardId);
  const positionFromTop = Math.max(
    1,
    Math.min(without.length + 1, Math.floor(requestedPosition)),
  );
  const insertionIndex = without.length - positionFromTop + 1;
  return [
    ...without.slice(0, insertionIndex),
    cardId,
    ...without.slice(insertionIndex),
  ];
};
