import { describe, expect, it } from "vitest";
import {
  buildDurableObjectDailyCheck,
  buildDurableObjectMetricsReport,
  resolveDurableObjectMetricsWindow,
  selectLatestWorkerDeploymentTimestamp,
  summarizeDurableObjectMetrics,
} from "../durableObjectMetrics";

describe("summarizeDurableObjectMetrics", () => {
  it("splits Durable Object duration around a deploy and ranks room concentration", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-04T22:00:00.000Z",
      windowEnd: "2026-07-04T22:30:00.000Z",
      periodic: [
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:05:00Z",
            name: "room-a",
          },
          sum: {
            duration: 90,
            inboundWebsocketMsgCount: 12,
            outboundWebsocketMsgCount: 20,
            subrequests: 4,
            storageReadUnits: 2,
            storageWriteUnits: 3,
            rowsRead: 10,
            rowsWritten: 11,
          },
        },
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:20:00Z",
            name: "room-b",
          },
          sum: {
            duration: 15,
            inboundWebsocketMsgCount: 1,
            outboundWebsocketMsgCount: 3,
            subrequests: 1,
            storageReadUnits: 0,
            storageWriteUnits: 1,
            rowsRead: 2,
            rowsWritten: 5,
          },
        },
      ],
      invocations: [
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:10:00Z",
            name: "room-a",
            type: "http",
            status: "clientDisconnected",
          },
          sum: { requests: 2, errors: 2, wallTime: 100 },
        },
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:25:00Z",
            name: "room-b",
            type: "hibernation",
            status: "success",
          },
          sum: { requests: 5, errors: 0, wallTime: 20 },
        },
      ],
    });

    expect(summary.totals.pre).toMatchObject({
      minutes: 17.616666666666667,
      rooms: 1,
      durationSec: 90,
      invocations: 2,
      errors: 2,
      byType: { "http:clientDisconnected": 2 },
    });
    expect(summary.totals.post).toMatchObject({
      minutes: 12.383333333333333,
      rooms: 1,
      durationSec: 15,
      invocations: 5,
      errors: 0,
      byType: { "hibernation:success": 5 },
    });
    expect(summary.totals.post.durationSecPerHour).toBeCloseTo(
      72.67833109017497,
    );
    expect(summary.concentration).toEqual({
      roomCount: 2,
      totalDurationSec: 105,
      top1Pct: 85.7,
      top5Pct: 100,
      top10Pct: 100,
    });
    expect(summary.comparison).toMatchObject({
      durationSecPerHourDeltaPct: -76.3,
      postWindowMinutes: 12.383333333333333,
      hasComparableWindows: true,
      maturity: "warming-up",
      canAssessDailyLimit: false,
      assessment: "insufficient-post-window",
      nextDailyAssessmentAt: "2026-07-05T22:17:37.000Z",
    });
    expect(summary.comparison.minutesUntilDailyAssessment).toBeCloseTo(
      1427.6166666666666,
    );
    expect(summary.comparison.durationSecPerHourPre).toBeCloseTo(
      306.5279091769158,
    );
    expect(summary.comparison.durationSecPerHourPost).toBeCloseTo(
      72.67833109017498,
    );
    expect(summary.comparison.durationSecPerHourDelta).toBeCloseTo(
      -233.8495780867408,
    );
    expect(summary.topRooms).toEqual([
      expect.objectContaining({
        room: "room-a",
        durationSec: 90,
        sharePct: 85.7,
        preDurationSec: 90,
        postDurationSec: 0,
      }),
      expect.objectContaining({
        room: "room-b",
        durationSec: 15,
        sharePct: 14.3,
        preDurationSec: 0,
        postDurationSec: 15,
      }),
    ]);
  });

  it("can exclude rows from other Durable Object namespaces", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-04T22:00:00.000Z",
      windowEnd: "2026-07-04T22:30:00.000Z",
      namespaceId: "room-namespace",
      periodic: [
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:20:00Z",
            name: "room-a",
            namespaceId: "room-namespace",
          },
          sum: { duration: 30 },
        },
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:20:00Z",
            name: "unrelated-object",
            namespaceId: "other-namespace",
          },
          sum: { duration: 500 },
        },
      ],
      invocations: [
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:20:00Z",
            name: "room-a",
            namespaceId: "room-namespace",
            type: "hibernation",
            status: "success",
          },
          sum: { requests: 2 },
        },
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:20:00Z",
            name: "unrelated-object",
            namespaceId: "other-namespace",
            type: "alarm",
            status: "success",
          },
          sum: { requests: 9 },
        },
      ],
    });

    expect(summary.concentration).toMatchObject({
      roomCount: 1,
      totalDurationSec: 30,
      top1Pct: 100,
    });
    expect(summary.totals.post).toMatchObject({
      rooms: 1,
      durationSec: 30,
      invocations: 2,
      byType: { "hibernation:success": 2 },
    });
    expect(summary.topRooms).toEqual([
      expect.objectContaining({
        room: "room-a",
        namespaceId: "room-namespace",
        durationSec: 30,
      }),
    ]);
  });

  it("infers the Room namespace from script-scoped invocation rows", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-04T22:00:00.000Z",
      windowEnd: "2026-07-04T22:30:00.000Z",
      periodic: [
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:20:00Z",
            name: "room-a",
            namespaceId: "room-namespace",
          },
          sum: { duration: 30 },
        },
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:20:00Z",
            name: "unrelated-object",
            namespaceId: "other-namespace",
          },
          sum: { duration: 500 },
        },
      ],
      invocations: [
        {
          dimensions: {
            datetimeFiveMinutes: "2026-07-04T22:20:00Z",
            name: "room-a",
            namespaceId: "room-namespace",
            type: "hibernation",
            status: "success",
          },
          sum: { requests: 2 },
        },
      ],
    });

    expect(summary.namespace).toEqual({
      requestedId: null,
      inferredId: "room-namespace",
      appliedId: "room-namespace",
      inference: "single-invocation-namespace",
      invocationNamespaceIds: ["room-namespace"],
    });
    expect(summary.concentration).toMatchObject({
      roomCount: 1,
      totalDurationSec: 30,
    });
    expect(summary.topRooms).toEqual([
      expect.objectContaining({
        room: "room-a",
        namespaceId: "room-namespace",
      }),
    ]);
  });
});

describe("selectLatestWorkerDeploymentTimestamp", () => {
  it("selects the newest deployment timestamp regardless of API ordering", () => {
    expect(
      selectLatestWorkerDeploymentTimestamp([
        { created_on: "2026-06-24T14:45:32.294277Z" },
        { created_on: "2026-07-04T22:17:37.704433Z" },
        { created_on: "2026-06-25T09:46:46.967841Z" },
      ]),
    ).toBe("2026-07-04T22:17:37.704433Z");
  });

  it("rejects empty or invalid deployment lists", () => {
    expect(() => selectLatestWorkerDeploymentTimestamp([])).toThrow(
      "No valid Worker deployments returned",
    );
    expect(() =>
      selectLatestWorkerDeploymentTimestamp([
        { created_on: "not-a-date" },
        { created_on: null },
      ]),
    ).toThrow("No valid Worker deployments returned");
  });
});

describe("resolveDurableObjectMetricsWindow", () => {
  it("defaults checkDaily windows to include a full pre-deploy baseline", () => {
    expect(
      resolveDurableObjectMetricsWindow({
        deployAt: "2026-07-04T22:17:37.000Z",
        now: "2026-07-04T23:00:00.000Z",
        hours: 24,
        checkDaily: true,
      }),
    ).toEqual({
      start: "2026-07-03T22:17:37.000Z",
      end: "2026-07-04T23:00:00.000Z",
    });
  });

  it("defaults mature checkDaily windows to the first full post-deploy day", () => {
    expect(
      resolveDurableObjectMetricsWindow({
        deployAt: "2026-07-04T22:17:37.000Z",
        now: "2026-07-06T09:00:00.000Z",
        hours: 24,
        checkDaily: true,
      }),
    ).toEqual({
      start: "2026-07-03T22:17:37.000Z",
      end: "2026-07-05T22:17:37.000Z",
    });
  });

  it("keeps the normal lookback default when daily checking is disabled", () => {
    expect(
      resolveDurableObjectMetricsWindow({
        deployAt: "2026-07-04T22:17:37.000Z",
        now: "2026-07-05T23:00:00.000Z",
        hours: 24,
        checkDaily: false,
      }),
    ).toEqual({
      start: "2026-07-04T23:00:00.000Z",
      end: "2026-07-05T23:00:00.000Z",
    });
  });

  it("keeps an explicit start over the checkDaily default", () => {
    expect(
      resolveDurableObjectMetricsWindow({
        deployAt: "2026-07-04T22:17:37.000Z",
        start: "2026-07-04T16:00:00.000Z",
        end: "2026-07-05T23:00:00.000Z",
        now: "2026-07-06T09:00:00.000Z",
        hours: 24,
        checkDaily: true,
      }),
    ).toEqual({
      start: "2026-07-04T16:00:00.000Z",
      end: "2026-07-05T23:00:00.000Z",
    });
  });
});

describe("buildDurableObjectDailyCheck", () => {
  it("waits until a full post-deploy daily window is available", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-04T16:00:00.000Z",
      windowEnd: "2026-07-04T23:17:37.000Z",
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T21:00:00Z" },
          sum: { duration: 600 },
        },
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T23:00:00Z" },
          sum: { duration: 60 },
        },
      ],
      invocations: [],
    });

    expect(buildDurableObjectDailyCheck(summary)).toEqual({
      status: "waiting",
      exitCode: 2,
      readyAt: "2026-07-05T22:17:37.000Z",
      message:
        "Daily Durable Object duration assessment is not ready until 2026-07-05T22:17:37.000Z.",
    });
  });

  it("includes the settle delay in immature daily-window retry guidance", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-03T22:17:37.000Z",
      windowEnd: "2026-07-04T23:17:37.000Z",
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T21:00:00Z" },
          sum: { duration: 600 },
        },
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T23:00:00Z" },
          sum: { duration: 60 },
        },
      ],
      invocations: [],
    });

    expect(
      buildDurableObjectDailyCheck(summary, {
        metricSettleDelayMinutes: 15,
      }),
    ).toEqual({
      status: "waiting",
      exitCode: 2,
      readyAt: "2026-07-05T22:32:37.000Z",
      message:
        "Daily Durable Object duration assessment is not ready until 2026-07-05T22:32:37.000Z.",
    });
  });

  it("passes when the full daily window shows an improved duration rate", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-03T22:17:37.000Z",
      windowEnd: "2026-07-05T22:17:37.000Z",
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T21:00:00Z" },
          sum: { duration: 2400 },
        },
        {
          dimensions: { datetimeFiveMinutes: "2026-07-05T21:00:00Z" },
          sum: { duration: 600 },
        },
      ],
      invocations: [],
    });

    expect(buildDurableObjectDailyCheck(summary)).toEqual({
      status: "pass",
      exitCode: 0,
      message:
        "Post-deploy Durable Object duration rate assessment passed: duration-rate-improved.",
    });
  });

  it("waits for the metrics window to settle before assessing a full day", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-03T22:17:37.000Z",
      windowEnd: "2026-07-05T22:17:37.000Z",
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T21:00:00Z" },
          sum: { duration: 2400 },
        },
        {
          dimensions: { datetimeFiveMinutes: "2026-07-05T21:00:00Z" },
          sum: { duration: 600 },
        },
      ],
      invocations: [],
    });

    expect(
      buildDurableObjectDailyCheck(summary, {
        now: "2026-07-05T22:22:37.000Z",
        metricSettleDelayMinutes: 15,
      }),
    ).toEqual({
      status: "waiting",
      exitCode: 2,
      readyAt: "2026-07-05T22:32:37.000Z",
      message:
        "Daily Durable Object duration assessment is waiting for Cloudflare metrics to settle until 2026-07-05T22:32:37.000Z.",
    });
  });

  it("fails when the full daily window remains above the configured duration limit", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-03T22:17:37.000Z",
      windowEnd: "2026-07-05T22:17:37.000Z",
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T21:00:00Z" },
          sum: { duration: 2400 },
        },
        {
          dimensions: { datetimeFiveMinutes: "2026-07-05T21:00:00Z" },
          sum: { duration: 1200 },
        },
      ],
      invocations: [],
    });

    expect(
      buildDurableObjectDailyCheck(summary, { durationLimitSec: 1000 }),
    ).toEqual({
      status: "fail",
      exitCode: 3,
      message:
        "Post-deploy Durable Object duration 1200s exceeded configured daily limit 1000s.",
    });
  });

  it("fails when source metric rows may be truncated", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-03T22:17:37.000Z",
      windowEnd: "2026-07-05T22:17:37.000Z",
      queryLimit: 2,
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T21:00:00Z" },
          sum: { duration: 2400 },
        },
        {
          dimensions: { datetimeFiveMinutes: "2026-07-05T21:00:00Z" },
          sum: { duration: 600 },
        },
      ],
      invocations: [],
    });

    expect(summary.sourceRows).toMatchObject({
      periodic: 2,
      queryLimit: 2,
      periodicLimitReached: true,
    });
    expect(buildDurableObjectDailyCheck(summary)).toEqual({
      status: "fail",
      exitCode: 3,
      message:
        "Cloudflare returned 2 periodic metric rows, which reached the query limit. Increase the query limit or narrow the window before trusting the daily assessment.",
    });
  });

  it("fails when the full daily window shows a regressed duration rate", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-03T22:17:37.000Z",
      windowEnd: "2026-07-05T22:17:37.000Z",
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T21:00:00Z" },
          sum: { duration: 600 },
        },
        {
          dimensions: { datetimeFiveMinutes: "2026-07-05T21:00:00Z" },
          sum: { duration: 2400 },
        },
      ],
      invocations: [],
    });

    expect(buildDurableObjectDailyCheck(summary)).toEqual({
      status: "fail",
      exitCode: 3,
      message:
        "Post-deploy Durable Object duration rate regressed by 300%.",
    });
  });

  it("fails explicitly when the daily window has no pre-deploy baseline", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-04T22:17:37.000Z",
      windowEnd: "2026-07-05T22:17:37.000Z",
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-05T21:00:00Z" },
          sum: { duration: 600 },
        },
      ],
      invocations: [],
    });

    expect(summary.comparison.assessment).toBe("missing-baseline");
    expect(buildDurableObjectDailyCheck(summary)).toEqual({
      status: "fail",
      exitCode: 3,
      message:
        "Daily Durable Object duration assessment is missing a pre-deploy baseline. Query a window that starts before deployAt.",
    });
  });
});

describe("buildDurableObjectMetricsReport", () => {
  it("adds the daily check result when one is provided", () => {
    const summary = summarizeDurableObjectMetrics({
      deployAt: "2026-07-04T22:17:37.000Z",
      windowStart: "2026-07-03T22:17:37.000Z",
      windowEnd: "2026-07-04T23:17:37.000Z",
      periodic: [
        {
          dimensions: { datetimeFiveMinutes: "2026-07-04T21:00:00Z" },
          sum: { duration: 600 },
        },
      ],
      invocations: [],
    });
    const dailyCheck = buildDurableObjectDailyCheck(summary, {
      metricSettleDelayMinutes: 15,
    });

    expect(buildDurableObjectMetricsReport(summary, dailyCheck)).toEqual(
      expect.objectContaining({
        deployAt: "2026-07-04T22:17:37.000Z",
        dailyCheck: expect.objectContaining({
          status: "waiting",
          readyAt: "2026-07-05T22:32:37.000Z",
        }),
      }),
    );
  });
});
