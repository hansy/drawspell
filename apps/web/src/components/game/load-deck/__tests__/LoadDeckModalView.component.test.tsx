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
    curatedDecks,
    activeCuratedDeckId: null,
    handleCuratedDeckImport: vi.fn(),
    ...overrides,
  }) as LoadDeckController;

describe("LoadDeckModalView", () => {
  it("renders curated decks grouped by format with mana symbols", async () => {
    render(<LoadDeckModalView {...controller()} />);

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
