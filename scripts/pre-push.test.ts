import { describe, expect, test } from "bun:test";

import { mainPushCommits } from "./pre-push";

const sha = "0123456789abcdef0123456789abcdef01234567";
const zero = "0000000000000000000000000000000000000000";

describe("pre-push main gate", () => {
  test("finds commits pushed to main, however the local ref is named", () => {
    expect(mainPushCommits(`refs/heads/feature ${sha} refs/heads/main ${zero}\n`)).toEqual([sha]);
    expect(mainPushCommits(`HEAD ${sha} refs/heads/main ${sha}\n`)).toEqual([sha]);
  });

  test("ignores pushes to other branches and tags", () => {
    expect(
      mainPushCommits(
        [
          `refs/heads/feature ${sha} refs/heads/feature ${zero}`,
          `refs/tags/v1 ${sha} refs/tags/v1 ${zero}`,
          `refs/heads/main ${sha} refs/heads/maintenance ${zero}`,
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  test("does not gate deleting main", () => {
    expect(mainPushCommits(`(delete) ${zero} refs/heads/main ${sha}\n`)).toEqual([]);
  });

  test("treats an empty push as nothing to check", () => {
    expect(mainPushCommits("")).toEqual([]);
  });
});
