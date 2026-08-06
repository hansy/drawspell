const uniqueMemberSetOrNull = (list: string[]) => {
  const members = new Set(list);
  return members.size === list.length ? members : null;
};

export const hasSameMembers = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const leftMembers = uniqueMemberSetOrNull(left);
  const rightMembers = uniqueMemberSetOrNull(right);
  if (!leftMembers || !rightMembers) return false;
  for (const entry of leftMembers) {
    if (!rightMembers.has(entry)) return false;
  }
  return true;
};

export const removeFromArray = (list: string[], id: string) =>
  list.filter((value) => value !== id);

export const placeCardId = (
  list: string[],
  cardId: string,
  placement: "top" | "bottom"
) => {
  const without = removeFromArray(list, cardId);
  if (placement === "bottom") return [cardId, ...without];
  return [...without, cardId];
};
