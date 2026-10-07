// Isolated review fixture: real Battlefield, drag/selection and camera components;
// sample state stays in this tab. No multiplayer connection is opened.
import React from "react";
import { createRoot } from "react-dom/client";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { Battlefield } from "@/components/game/seat/Battlefield";
import { CardPreviewProvider } from "@/components/game/card/CardPreviewProvider";
import { CardDragOverlayView } from "@/components/game/board/CardDragOverlayView";
import { useGameDnD } from "@/hooks/game/dnd/useGameDnD";
import { useGameStore } from "@/store/gameStore";
import { useDragStore } from "@/store/dragStore";
import { resolveBattlefieldCollisionPosition } from "@mtg/shared/positions";
import type { Card, Player, Zone } from "@/types";
import "@/styles.css";

const players: Record<string, Player> = Object.fromEntries(
  ["wide", "narrow", "rotated"].map((id) => [
    id,
    {
      id,
      name: id,
      life: 40,
      counters: [],
      commanderTax: 0,
      commanderDamage: {},
    },
  ]),
);
const zones: Record<string, Zone> = Object.fromEntries(
  Object.keys(players).map((id) => [
    id,
    {
      id,
      ownerId: id,
      type: "battlefield",
      cardIds: ["island", "talisman", "creature"].map((c) => `${id}-${c}`),
    },
  ]),
);
const cards: Record<string, Card> = {};
for (const owner of Object.keys(players)) {
  ["Island", "Talisman of Conviction", "Sample Creature"].forEach((name, i) => {
    const id = zones[owner].cardIds[i];
    cards[id] = {
      id,
      name,
      ownerId: owner,
      controllerId: "wide",
      zoneId: owner,
      position: { x: i * 0.16, y: 0 },
      tapped: false,
      faceDown: false,
      rotation: 0,
      imageUrl: "/mtg_card_back.jpeg",
      typeLine: i === 2 ? "Creature" : "Artifact",
      power: i === 2 ? "3" : undefined,
      toughness: i === 2 ? "4" : undefined,
      counters: i === 2 ? [{ type: "+1/+1", count: 2, color: "#8b5cf6" }] : [],
    };
  });
}
useGameStore.setState({
  sessionId: "camera-review",
  myPlayerId: "wide",
  viewerRole: "player",
  players,
  zones,
  cards,
  battlefieldViewScale: {},
  battlefieldGridSizing: {},
  moveCard: (cardId, toZoneId, position) => {
    if (!position) return;
    useGameStore.setState((state) => {
      const next = resolveBattlefieldCollisionPosition({
        movingCardId: cardId,
        targetPosition: position,
        orderedCardIds: state.zones[toZoneId].cardIds,
        getPosition: (id) => state.cards[id]?.position,
      });
      // Mirror the same arrangement into the three review windows.
      const suffix = cardId.substring(cardId.indexOf("-") + 1);
      return {
        cards: Object.fromEntries(
          Object.entries(state.cards).map(([id, c]) => [
            id,
            id.endsWith(suffix) ? { ...c, position: next } : c,
          ]),
        ),
      };
    });
  },
});
function App() {
  const state = useGameStore();
  const drag = useGameDnD();
  const active = useDragStore((s) => s.activeCardId);
  const overScale = useDragStore((s) => s.overCardScale);
  const [height, setHeight] = React.useState(320);
  return (
    <CardPreviewProvider>
      <DndContext
        sensors={drag.sensors}
        onDragStart={drag.handleDragStart}
        onDragMove={drag.handleDragMove}
        onDragEnd={drag.handleDragEnd}
      >
        <main
          style={{
            padding: 24,
            background: "#09090b",
            color: "#f4f4f5",
            minHeight: "100vh",
            fontFamily: "system-ui",
          }}
        >
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 24,
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ color: "#a5f3fc", fontSize: 12, letterSpacing: 2 }}>
                DRAWSPELL / CAMERA PREVIEW
              </div>
              <h1 style={{ fontSize: 24, marginTop: 6 }}>
                One arrangement. Independent views.
              </h1>
              <p style={{ color: "#a1a1aa", fontSize: 13 }}>
                Right-drag empty space to pan · Scroll to zoom · The zoom slider
                appears briefly while zooming
              </p>
            </div>
            <label style={{ fontSize: 12, color: "#a1a1aa" }}>
              Battlefield height{" "}
              <input
                aria-label="Battlefield height"
                type="range"
                min="220"
                max="500"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </label>
          </header>
          <div style={{ display: "grid", gap: 16 }}>
            {Object.keys(players).map((id, index) => (
              <section
                key={id}
                style={{
                  width: index === 0 ? "100%" : index === 1 ? "65%" : "80%",
                  minWidth: 280,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#a1a1aa",
                    marginBottom: 6,
                  }}
                >
                  <span>
                    {index === 0
                      ? "Wide view"
                      : index === 1
                        ? "Narrow view"
                        : "Opponent view · rotated 180°"}
                  </span>
                  <span>Default = 3 card heights</span>
                </div>
                <div
                  style={{
                    height,
                    display: "flex",
                    position: "relative",
                    border: `1px solid ${index === 2 ? "#6d28d9" : "#155e75"}`,
                    boxShadow: `inset 0 0 24px ${index === 2 ? "#6d28d930" : "#0891b220"}`,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <Battlefield
                    zone={zones[id]}
                    player={players[id]}
                    cards={zones[id].cardIds.map((c) => state.cards[c])}
                    isTop={index === 2}
                    isMe={id === "wide"}
                    viewerPlayerId="wide"
                    playerColors={{
                      wide: "sky",
                      narrow: "sky",
                      rotated: "violet",
                    }}
                  />
                </div>
              </section>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#71717a", marginTop: 16 }}>
            Local sample only. Dragging a sample card updates its position in
            all three windows; camera changes stay independent.
          </p>
        </main>
        <DragOverlay dropAnimation={null}>
          {active && state.cards[active] ? (
            <div
              style={{
                transform: `scale(${overScale})`,
                transformOrigin: "center",
              }}
            >
              <CardDragOverlayView
                card={state.cards[active]}
                faceDown={false}
                preferArtCrop={false}
                data-dnd-drag-overlay-card-view-id={active}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </CardPreviewProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
