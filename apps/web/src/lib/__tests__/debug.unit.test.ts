import { describe, expect, it } from "vitest";

import { summarizeGhostElement } from "../debug";

describe("debug element summaries", () => {
  it("includes ghost identity attributes needed to distinguish render paths", () => {
    document.body.innerHTML = `
      <div
        data-card-id="c1"
        data-dnd-ghost-card-id="c1"
        data-dnd-ghost-kind="single"
        style="position: absolute; left: 10px; top: 20px; width: 90px; height: 135px;"
      ></div>
    `;

    expect(summarizeGhostElement("c1")).toMatchObject({
      dataAttributes: {
        cardId: "c1",
        dndGhostCardId: "c1",
        dndGhostKind: "single",
      },
    });
  });
});
