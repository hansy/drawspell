import {
  pointerWithin,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";

import { ZONE } from "@/constants/zones";

const getDropData = (collision: Collision) =>
  collision.data?.droppableContainer?.data.current;

export const prioritizeBottomBarDropTargets = (
  collisions: Collision[],
): Collision[] => {
  const bottomBar = collisions.find(
    (collision) => getDropData(collision)?.dropSurface === "bottom-bar",
  );
  if (!bottomBar) return collisions;

  const hasExplicitBottomBarZone = collisions.some((collision) => {
    const data = getDropData(collision);
    return (
      data?.zoneId !== undefined &&
      collision.id === data.zoneId &&
      data.type !== ZONE.BATTLEFIELD
    );
  });

  if (hasExplicitBottomBarZone) {
    return collisions.filter((collision) => collision !== bottomBar);
  }

  return [bottomBar];
};

export const bottomBarAwarePointerWithin: CollisionDetection = (args) =>
  prioritizeBottomBarDropTargets(pointerWithin(args));
