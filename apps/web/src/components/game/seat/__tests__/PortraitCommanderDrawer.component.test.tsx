import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";

import { CardPreviewProvider } from "@/components/game/card/CardPreviewProvider";
import { ZONE } from "@/constants/zones";
import { useGameStore } from "@/store/gameStore";
import type { Card, Zone } from "@/types";

import { PortraitCommanderDrawer } from "../PortraitCommanderDrawer";

const zone = {
  id: "cmd-p1",
  ownerId: "p1",
  type: ZONE.COMMANDER,
  cardIds: [],
} as Zone;

const card = {
  id: "cmd-1",
  name: "Commander One",
  ownerId: "p1",
  controllerId: "p1",
  zoneId: zone.id,
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
  commanderTax: 2,
  isCommander: true,
} as Card;

describe("PortraitCommanderDrawer", () => {
  beforeEach(() => {
    useGameStore.setState({
      myPlayerId: "me",
      viewerRole: "player",
      cards: { [card.id]: card },
      zones: { [zone.id]: zone },
    } as any);
  });

  const renderDrawer = (cards: Card[] = []) =>
    render(
      <DndContext>
        <CardPreviewProvider>
          <PortraitCommanderDrawer open zone={zone} cards={cards} />
        </CardPreviewProvider>
      </DndContext>,
    );

  it("does not show opponent-facing drop hint in empty commander drawer", () => {
    renderDrawer();

    expect(screen.queryByText("Drop cards here")).toBeNull();
    expect(screen.getByText("Cmdr")).not.toBeNull();
  });

  it("hides commander tax controls when viewing an opponent commander", () => {
    const { container } = renderDrawer([card]);

    expect(
      screen.queryByRole("button", {
        name: `Decrease commander tax for ${card.name}`,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: `Increase commander tax for ${card.name}`,
      }),
    ).toBeNull();

    const drawer = container.firstElementChild as HTMLElement | null;
    const zoneElement = container.querySelector('[data-zone-id="cmd-p1"]');
    const cardFrame = container.querySelector('[data-card-id="cmd-1"]')?.parentElement;
    expect(drawer?.style.getPropertyValue("--cmdr-max-card-w")).toContain("11rem");
    expect(drawer?.style.getPropertyValue("--cmdr-max-card-w")).toContain("1rem");
    expect(drawer?.style.getPropertyValue("--cmdr-card-h")).toContain("1rem");
    expect(zoneElement?.classList.contains("p-1")).toBe(true);
    expect(zoneElement?.classList.contains("pt-5")).toBe(false);
    expect(cardFrame?.classList.contains("h-[var(--cmdr-card-h)]")).toBe(true);
  });
});
