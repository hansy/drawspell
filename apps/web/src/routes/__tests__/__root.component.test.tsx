import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  HeadContent: () => null,
  Scripts: () => null,
  createRootRoute: vi.fn((options: unknown) => options),
}));

vi.mock("sonner", () => ({ Toaster: () => null }));

import { RootDocument } from "../__root";

describe("root document canvas", () => {
  it("paints a dark background before stylesheets and hydration load", () => {
    const markup = renderToStaticMarkup(
      <RootDocument>
        <main>Drawspell</main>
      </RootDocument>,
    );

    expect(markup).toContain(
      '<html lang="en" style="background-color:#09090b;color-scheme:dark">',
    );
    expect(markup).toContain('<body style="background-color:#09090b">');
  });
});
