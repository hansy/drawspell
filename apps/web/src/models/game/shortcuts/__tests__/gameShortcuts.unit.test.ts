import { describe, expect, it } from "vitest";
import { GAME_SHORTCUTS, formatShortcutBinding } from "../gameShortcuts";

describe("GAME_SHORTCUTS", () => {
  it("has unique ids", () => {
    const ids = GAME_SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique bindings", () => {
    const bindings = GAME_SHORTCUTS.map((s) => formatShortcutBinding(s.binding));
    expect(new Set(bindings).size).toBe(bindings.length);
  });

  it("lists Pass Turn on Space", () => {
    const passTurn = GAME_SHORTCUTS.find((shortcut) => shortcut.id === "game.passTurn");
    expect(passTurn?.title).toBe("Pass Turn");
    expect(passTurn && formatShortcutBinding(passTurn.binding)).toBe("Space");
  });
});
