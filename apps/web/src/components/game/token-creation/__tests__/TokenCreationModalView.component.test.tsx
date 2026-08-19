import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TokenCreationController } from "@/hooks/game/token-creation/useTokenCreationController";
import type { ScryfallCard } from "@/types/scryfall";

import { TokenCreationModalView } from "../TokenCreationModalView";

const token = {
  id: "treasure-token",
  name: "Treasure",
  image_uris: { normal: "https://example.com/treasure.jpg" },
} as ScryfallCard;

const controller = {
  isOpen: true,
  handleClose: vi.fn(),
  query: "treasure",
  setQuery: vi.fn(),
  results: [token, { ...token, id: "treasure-token-2" }],
  isLoading: false,
  hasSearched: true,
  selectedToken: null,
  setSelectedToken: vi.fn(),
  quantity: 1,
  decrementQuantity: vi.fn(),
  incrementQuantity: vi.fn(),
  handleCreate: vi.fn(),
} as TokenCreationController;

describe("TokenCreationModalView", () => {
  it("reserves a grid track at least as wide as each token preview", () => {
    render(<TokenCreationModalView {...controller} />);

    const grid = screen.getByRole("list", { name: "Token search results" });
    const preview = screen.getAllByRole("listitem")[0];

    expect(grid.style.gridTemplateColumns).toBe(
      `repeat(auto-fill, minmax(${preview.style.width}, 1fr))`,
    );
  });

  it("uses the shared physical-card corner mask for token results", () => {
    render(<TokenCreationModalView {...controller} />);

    const preview = screen.getAllByRole("listitem")[0];
    const artwork = screen.getAllByRole("img", { name: "Treasure" })[0];

    expect(preview.classList.contains("rounded-[4.5%]")).toBe(true);
    expect(preview.classList.contains("overflow-hidden")).toBe(true);
    expect(artwork.classList.contains("rounded-[4.5%]")).toBe(true);
  });
});
