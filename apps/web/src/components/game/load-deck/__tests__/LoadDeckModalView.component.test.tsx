import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { curatedDecks } from "@/data/curatedDecks";
import type { LoadDeckController } from "@/hooks/game/load-deck/useLoadDeckController";

import { LoadDeckModalView } from "../LoadDeckModalView";

const controller = (overrides: Partial<LoadDeckController> = {}) =>
  ({
    isOpen: true,
    handleClose: vi.fn(),
    textareaRef: React.createRef<HTMLTextAreaElement>(),
    importText: "",
    handleImportTextChange: vi.fn(),
    prefilledFromLastImport: false,
    error: null,
    isImporting: false,
    handleImport: vi.fn(),
    curatedDecksEnabled: false,
    curatedDecks,
    activeCuratedDeckId: null,
    handleCuratedDeckImport: vi.fn(),
    ...overrides,
  }) as LoadDeckController;

describe("LoadDeckModalView", () => {
  it("hides curated decks when the feature flag is disabled", () => {
    render(<LoadDeckModalView {...controller({ curatedDecksEnabled: false })} />);

    expect(screen.queryByText("Curated Decks")).toBeNull();
    expect(screen.queryByRole("button", { name: /Avengers Assemble/ })).toBeNull();
  });

  it("renders curated decks grouped by format with mana symbols when enabled", async () => {
    render(<LoadDeckModalView {...controller({ curatedDecksEnabled: true })} />);

    expect(await screen.findByText("Curated Decks")).not.toBeNull();
    expect(screen.queryByText("Pick one to fill the list and load it.")).toBeNull();
    expect(screen.queryByText("Hero creatures and team-wide counters.")).toBeNull();
    expect(screen.queryByText("100 cards")).toBeNull();
    expect(screen.getAllByText("Commander").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Starter").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Avengers Assemble/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: /White Welcome Deck/ })).not.toBeNull();
    expect(document.body.querySelector(".ms.ms-cost.ms-w")).not.toBeNull();
    expect(document.body.querySelector(".ms.ms-cost.ms-u")).not.toBeNull();
    expect(document.body.querySelector(".ms.ms-cost.ms-r")).not.toBeNull();
  });
});
