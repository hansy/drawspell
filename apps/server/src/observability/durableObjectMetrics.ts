export type DurableObjectPeriodicRow = {
  dimensions: {
    datetimeFiveMinutes?: string | null;
    name?: string | null;
    namespaceId?: string | null;
    objectId?: string | null;
  };
  sum: {
    duration?: number | null;
    activeTime?: number | null;
    cpuTime?: number | null;
    inboundWebsocketMsgCount?: number | null;
    outboundWebsocketMsgCount?: number | null;
    subrequests?: number | null;
    storageReadUnits?: number | null;
    storageWriteUnits?: number | null;
    rowsRead?: number | null;
    rowsWritten?: number | null;
  };
};

export type DurableObjectInvocationRow = {
  dimensions: {
    datetimeFiveMinutes?: string | null;
    name?: string | null;
    namespaceId?: string | null;
    type?: string | null;
    status?: string | null;
  };
  sum: {
    requests?: number | null;
    errors?: number | null;
    wallTime?: number | null;
  };
};

export type WorkerDeploymentTimestamp = {
  created_on?: string | null;
};

type SplitKey = "pre" | "post";

type TotalsAccumulator = {
  buckets: Set<string>;
  rooms: Set<string>;
  durationSec: number;
  activeTime: number;
  cpuTime: number;
  inbound: number;
  outbound: number;
  subrequests: number;
  storageReadUnits: number;
  storageWriteUnits: number;
  rowsRead: number;
  rowsWritten: number;
  invocations: number;
  errors: number;
  wallTime: number;
  byType: Record<string, number>;
};

type DurableObjectRoomSummaryDraft = Omit<
  DurableObjectRoomSummary,
  "sharePct"
>;

export type DurableObjectMetricTotals = {
  minutes: number;
  buckets: number;
  rooms: number;
  durationSec: number;
  durationSecPerHour: number;
  activeTime: number;
  cpuTime: number;
  inbound: number;
  outbound: number;
  subrequests: number;
  storageReadUnits: number;
  storageWriteUnits: number;
  rowsRead: number;
  rowsWritten: number;
  invocations: number;
  errors: number;
  wallTime: number;
  byType: Record<string, number>;
};

export type DurableObjectRoomSummary = {
  room: string;
  namespaceId: string | null;
  firstBucket: string | null;
  lastBucket: string | null;
  buckets: number;
  durationSec: number;
  sharePct: number;
  preDurationSec: number;
  postDurationSec: number;
  inbound: number;
  outbound: number;
  subrequests: number;
  storageReadUnits: number;
  storageWriteUnits: number;
  rowsRead: number;
  rowsWritten: number;
  invocations: number;
  errors: number;
  invocationTypes: Record<string, number>;
};

export type DurableObjectMetricsSummary = {
  windowStart: string;
  deployAt: string;
  windowEnd: string;
  sourceRows: {
    periodic: number;
    invocations: number;
    queryLimit: number | null;
    periodicLimitReached: boolean;
    invocationLimitReached: boolean;
  };
  namespace: {
    requestedId: string | null;
    inferredId: string | null;
    appliedId: string | null;
    inference:
      | "explicit"
      | "single-invocation-namespace"
      | "ambiguous-invocation-namespace"
      | "unavailable";
    invocationNamespaceIds: string[];
  };
  totals: {
    pre: DurableObjectMetricTotals;
    post: DurableObjectMetricTotals;
  };
  comparison: {
    durationSecPerHourPre: number;
    durationSecPerHourPost: number;
    durationSecPerHourDelta: number;
    durationSecPerHourDeltaPct: number | null;
    preWindowMinutes: number;
    postWindowMinutes: number;
    hasComparableWindows: boolean;
    maturity: "warming-up" | "partial-day" | "daily-window";
    canAssessDailyLimit: boolean;
    nextDailyAssessmentAt: string;
    minutesUntilDailyAssessment: number;
    assessment:
      | "insufficient-post-window"
      | "duration-rate-improved"
      | "duration-rate-regressed"
      | "duration-rate-flat"
      | "missing-baseline";
  };
  concentration: {
    roomCount: number;
    totalDurationSec: number;
    top1Pct: number;
    top5Pct: number;
    top10Pct: number;
  };
  topRooms: DurableObjectRoomSummary[];
};

export type DurableObjectDailyCheck = {
  status: "waiting" | "pass" | "fail";
  exitCode: 0 | 2 | 3;
  message: string;
  readyAt?: string;
};

export type DurableObjectMetricsReport = DurableObjectMetricsSummary & {
  dailyCheck?: DurableObjectDailyCheck;
};

export type DurableObjectDailyCheckOptions = {
  durationLimitSec?: number;
  metricSettleDelayMinutes?: number;
  now?: string;
};

export type ResolveDurableObjectMetricsWindowInput = {
  deployAt: string;
  start?: string | null;
  end?: string | null;
  now?: string;
  hours?: number;
  checkDaily?: boolean;
};

export type SummarizeDurableObjectMetricsInput = {
  windowStart: string;
  deployAt: string;
  windowEnd: string;
  periodic: DurableObjectPeriodicRow[];
  invocations: DurableObjectInvocationRow[];
  namespaceId?: string;
  topRoomLimit?: number;
  queryLimit?: number;
};

const emptyTotals = (): TotalsAccumulator => ({
  buckets: new Set(),
  rooms: new Set(),
  durationSec: 0,
  activeTime: 0,
  cpuTime: 0,
  inbound: 0,
  outbound: 0,
  subrequests: 0,
  storageReadUnits: 0,
  storageWriteUnits: 0,
  rowsRead: 0,
  rowsWritten: 0,
  invocations: 0,
  errors: 0,
  wallTime: 0,
  byType: {},
});

const numberValue = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const round = (value: number, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const bucketTime = (value: string | null | undefined) => {
  if (!value) return Number.NaN;
  return Date.parse(value);
};

const splitForBucket = (
  bucket: string | null | undefined,
  deployAtMs: number,
): SplitKey => {
  const parsed = bucketTime(bucket);
  return Number.isFinite(parsed) && parsed < deployAtMs ? "pre" : "post";
};

const getInvocationNamespaceIds = (
  invocations: DurableObjectInvocationRow[],
) => {
  return [
    ...new Set(
      invocations
        .map((row) => row.dimensions.namespaceId)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
};

export const selectLatestWorkerDeploymentTimestamp = (
  deployments: WorkerDeploymentTimestamp[],
) => {
  const latest = deployments
    .map((deployment) => deployment.created_on)
    .filter((createdOn): createdOn is string => Boolean(createdOn))
    .map((createdOn) => ({ createdOn, timestamp: Date.parse(createdOn) }))
    .filter(({ timestamp }) => Number.isFinite(timestamp))
    .sort((left, right) => right.timestamp - left.timestamp)[0];

  if (!latest) {
    throw new Error("No valid Worker deployments returned");
  }

  return latest.createdOn;
};

export const resolveDurableObjectMetricsWindow = ({
  deployAt,
  start,
  end,
  now = new Date().toISOString(),
  hours = 24,
  checkDaily = false,
}: ResolveDurableObjectMetricsWindowInput) => {
  const deployAtMs = Date.parse(deployAt);
  const firstDailyAssessmentAt = new Date(
    deployAtMs + 24 * 60 * 60 * 1000,
  ).toISOString();
  const resolvedEnd =
    end ??
    (checkDaily && Date.parse(now) >= Date.parse(firstDailyAssessmentAt)
      ? firstDailyAssessmentAt
      : now);

  if (start) return { start, end: resolvedEnd };

  if (checkDaily) {
    return {
      start: new Date(deployAtMs - 24 * 60 * 60 * 1000).toISOString(),
      end: resolvedEnd,
    };
  }

  return {
    start: new Date(
      Date.parse(resolvedEnd) - hours * 60 * 60 * 1000,
    ).toISOString(),
    end: resolvedEnd,
  };
};

const formatSeconds = (value: number) => `${round(value, 3)}s`;

export const buildDurableObjectDailyCheck = (
  summary: DurableObjectMetricsSummary,
  options: DurableObjectDailyCheckOptions = {},
): DurableObjectDailyCheck => {
  const metricSettleDelayMinutes =
    typeof options.metricSettleDelayMinutes === "number" &&
    Number.isFinite(options.metricSettleDelayMinutes) &&
    options.metricSettleDelayMinutes > 0
      ? options.metricSettleDelayMinutes
      : 0;
  const withSettleDelay = (iso: string) => {
    const parsed = Date.parse(iso);
    return new Date(parsed + metricSettleDelayMinutes * 60_000).toISOString();
  };

  if (summary.comparison.assessment === "missing-baseline") {
    return {
      status: "fail",
      exitCode: 3,
      message:
        "Daily Durable Object duration assessment is missing a pre-deploy baseline. Query a window that starts before deployAt.",
    };
  }

  if (summary.comparison.maturity !== "daily-window") {
    const readyAt = withSettleDelay(summary.comparison.nextDailyAssessmentAt);
    return {
      status: "waiting",
      exitCode: 2,
      readyAt,
      message: `Daily Durable Object duration assessment is not ready until ${readyAt}.`,
    };
  }

  if (metricSettleDelayMinutes > 0) {
    const settledAtMs =
      Date.parse(summary.windowEnd) + metricSettleDelayMinutes * 60_000;
    const nowMs = Date.parse(options.now ?? new Date().toISOString());
    if (Number.isFinite(settledAtMs) && nowMs < settledAtMs) {
      const readyAt = new Date(settledAtMs).toISOString();
      return {
        status: "waiting",
        exitCode: 2,
        readyAt,
        message: `Daily Durable Object duration assessment is waiting for Cloudflare metrics to settle until ${readyAt}.`,
      };
    }
  }

  if (
    summary.sourceRows.periodicLimitReached ||
    summary.sourceRows.invocationLimitReached
  ) {
    const kind = summary.sourceRows.periodicLimitReached
      ? "periodic"
      : "invocation";
    const count = summary.sourceRows.periodicLimitReached
      ? summary.sourceRows.periodic
      : summary.sourceRows.invocations;
    return {
      status: "fail",
      exitCode: 3,
      message: `Cloudflare returned ${count} ${kind} metric rows, which reached the query limit. Increase the query limit or narrow the window before trusting the daily assessment.`,
    };
  }

  if (
    typeof options.durationLimitSec === "number" &&
    Number.isFinite(options.durationLimitSec) &&
    summary.totals.post.durationSec > options.durationLimitSec
  ) {
    return {
      status: "fail",
      exitCode: 3,
      message: `Post-deploy Durable Object duration ${formatSeconds(summary.totals.post.durationSec)} exceeded configured daily limit ${formatSeconds(options.durationLimitSec)}.`,
    };
  }

  if (summary.comparison.assessment === "duration-rate-regressed") {
    return {
      status: "fail",
      exitCode: 3,
      message: `Post-deploy Durable Object duration rate regressed by ${summary.comparison.durationSecPerHourDeltaPct}%.`,
    };
  }

  return {
    status: "pass",
    exitCode: 0,
    message: `Post-deploy Durable Object duration rate assessment passed: ${summary.comparison.assessment}.`,
  };
};

export const buildDurableObjectMetricsReport = (
  summary: DurableObjectMetricsSummary,
  dailyCheck?: DurableObjectDailyCheck,
): DurableObjectMetricsReport => ({
  ...summary,
  ...(dailyCheck ? { dailyCheck } : {}),
});

const resolveNamespace = (
  requestedNamespaceId: string | undefined,
  invocations: DurableObjectInvocationRow[],
): DurableObjectMetricsSummary["namespace"] => {
  const invocationNamespaceIds = getInvocationNamespaceIds(invocations);
  if (requestedNamespaceId) {
    return {
      requestedId: requestedNamespaceId,
      inferredId: null,
      appliedId: requestedNamespaceId,
      inference: "explicit",
      invocationNamespaceIds,
    };
  }
  if (invocationNamespaceIds.length === 1) {
    return {
      requestedId: null,
      inferredId: invocationNamespaceIds[0],
      appliedId: invocationNamespaceIds[0],
      inference: "single-invocation-namespace",
      invocationNamespaceIds,
    };
  }
  return {
    requestedId: null,
    inferredId: null,
    appliedId: null,
    inference:
      invocationNamespaceIds.length > 1
        ? "ambiguous-invocation-namespace"
        : "unavailable",
    invocationNamespaceIds,
  };
};

const compactTotals = (
  totals: TotalsAccumulator,
  windowStart: string,
  windowEnd: string,
): DurableObjectMetricTotals => {
  const minutes = Math.max(
    0,
    (Date.parse(windowEnd) - Date.parse(windowStart)) / 60_000,
  );
  return {
    minutes,
    buckets: totals.buckets.size,
    rooms: totals.rooms.size,
    durationSec: totals.durationSec,
    durationSecPerHour:
      minutes > 0 ? (totals.durationSec / minutes) * 60 : 0,
    activeTime: totals.activeTime,
    cpuTime: totals.cpuTime,
    inbound: totals.inbound,
    outbound: totals.outbound,
    subrequests: totals.subrequests,
    storageReadUnits: totals.storageReadUnits,
    storageWriteUnits: totals.storageWriteUnits,
    rowsRead: totals.rowsRead,
    rowsWritten: totals.rowsWritten,
    invocations: totals.invocations,
    errors: totals.errors,
    wallTime: totals.wallTime,
    byType: totals.byType,
  };
};

const createRoomSummaryDraft = (
  room: string,
  namespaceId: string | null | undefined,
): DurableObjectRoomSummaryDraft => ({
  room,
  namespaceId: namespaceId ?? null,
  firstBucket: null,
  lastBucket: null,
  buckets: 0,
  durationSec: 0,
  preDurationSec: 0,
  postDurationSec: 0,
  inbound: 0,
  outbound: 0,
  subrequests: 0,
  storageReadUnits: 0,
  storageWriteUnits: 0,
  rowsRead: 0,
  rowsWritten: 0,
  invocations: 0,
  errors: 0,
  invocationTypes: {},
});

const buildComparison = (
  pre: DurableObjectMetricTotals,
  post: DurableObjectMetricTotals,
  deployAt: string,
  windowEnd: string,
): DurableObjectMetricsSummary["comparison"] => {
  const delta = post.durationSecPerHour - pre.durationSecPerHour;
  const nextDailyAssessmentMs = Date.parse(deployAt) + 24 * 60 * 60 * 1000;
  const minutesUntilDailyAssessment = Math.max(
    0,
    (nextDailyAssessmentMs - Date.parse(windowEnd)) / 60_000,
  );
  const maturity =
    post.minutes < 60
      ? "warming-up"
      : post.minutes < 24 * 60
        ? "partial-day"
        : "daily-window";
  const canAssessDailyLimit =
    maturity === "daily-window" && pre.durationSecPerHour > 0;
  const deltaPct =
    pre.durationSecPerHour > 0
      ? round((delta / pre.durationSecPerHour) * 100, 1)
      : null;
  const assessment = (() => {
    if (pre.durationSecPerHour <= 0) return "missing-baseline";
    if (!canAssessDailyLimit) return "insufficient-post-window";
    if (deltaPct !== null && deltaPct <= -10) return "duration-rate-improved";
    if (deltaPct !== null && deltaPct >= 10) return "duration-rate-regressed";
    return "duration-rate-flat";
  })();
  return {
    durationSecPerHourPre: pre.durationSecPerHour,
    durationSecPerHourPost: post.durationSecPerHour,
    durationSecPerHourDelta: delta,
    durationSecPerHourDeltaPct: deltaPct,
    preWindowMinutes: pre.minutes,
    postWindowMinutes: post.minutes,
    hasComparableWindows: pre.minutes > 0 && post.minutes > 0,
    maturity,
    canAssessDailyLimit,
    nextDailyAssessmentAt: new Date(nextDailyAssessmentMs).toISOString(),
    minutesUntilDailyAssessment,
    assessment,
  };
};

export const summarizeDurableObjectMetrics = ({
  windowStart,
  deployAt,
  windowEnd,
  periodic,
  invocations,
  namespaceId,
  topRoomLimit = 25,
  queryLimit,
}: SummarizeDurableObjectMetricsInput): DurableObjectMetricsSummary => {
  const deployAtMs = Date.parse(deployAt);
  const normalizedQueryLimit =
    typeof queryLimit === "number" && Number.isFinite(queryLimit) && queryLimit > 0
      ? Math.floor(queryLimit)
      : null;
  const namespace = resolveNamespace(namespaceId, invocations);
  const totals: Record<SplitKey, TotalsAccumulator> = {
    pre: emptyTotals(),
    post: emptyTotals(),
  };
  const rooms = new Map<string, DurableObjectRoomSummaryDraft>();

  const roomKey = (room: string, rowNamespaceId: string | null | undefined) =>
    `${rowNamespaceId ?? ""}\u0000${room}`;
  const shouldIncludeNamespace = (rowNamespaceId: string | null | undefined) =>
    !namespace.appliedId || rowNamespaceId === namespace.appliedId;

  const ensureRoom = (room: string, rowNamespaceId: string | null | undefined) => {
    const key = roomKey(room, rowNamespaceId);
    const existing = rooms.get(key);
    if (existing) return existing;
    const next = createRoomSummaryDraft(room, rowNamespaceId);
    rooms.set(key, next);
    return next;
  };

  for (const row of periodic) {
    if (!shouldIncludeNamespace(row.dimensions.namespaceId)) continue;
    const bucket = row.dimensions.datetimeFiveMinutes ?? null;
    const room = row.dimensions.name ?? "(unknown)";
    const split = splitForBucket(bucket, deployAtMs);
    const splitTotals = totals[split];
    if (bucket) splitTotals.buckets.add(bucket);
    splitTotals.rooms.add(room);

    const duration = numberValue(row.sum.duration);
    const inbound = numberValue(row.sum.inboundWebsocketMsgCount);
    const outbound = numberValue(row.sum.outboundWebsocketMsgCount);
    const subrequests = numberValue(row.sum.subrequests);
    const storageReadUnits = numberValue(row.sum.storageReadUnits);
    const storageWriteUnits = numberValue(row.sum.storageWriteUnits);
    const rowsRead = numberValue(row.sum.rowsRead);
    const rowsWritten = numberValue(row.sum.rowsWritten);

    splitTotals.durationSec += duration;
    splitTotals.activeTime += numberValue(row.sum.activeTime);
    splitTotals.cpuTime += numberValue(row.sum.cpuTime);
    splitTotals.inbound += inbound;
    splitTotals.outbound += outbound;
    splitTotals.subrequests += subrequests;
    splitTotals.storageReadUnits += storageReadUnits;
    splitTotals.storageWriteUnits += storageWriteUnits;
    splitTotals.rowsRead += rowsRead;
    splitTotals.rowsWritten += rowsWritten;

    const roomSummary = ensureRoom(room, row.dimensions.namespaceId);
    roomSummary.firstBucket =
      roomSummary.firstBucket && bucket
        ? roomSummary.firstBucket < bucket
          ? roomSummary.firstBucket
          : bucket
        : bucket ?? roomSummary.firstBucket;
    roomSummary.lastBucket =
      roomSummary.lastBucket && bucket
        ? roomSummary.lastBucket > bucket
          ? roomSummary.lastBucket
          : bucket
        : bucket ?? roomSummary.lastBucket;
    roomSummary.buckets += 1;
    roomSummary.durationSec += duration;
    roomSummary[split === "pre" ? "preDurationSec" : "postDurationSec"] +=
      duration;
    roomSummary.inbound += inbound;
    roomSummary.outbound += outbound;
    roomSummary.subrequests += subrequests;
    roomSummary.storageReadUnits += storageReadUnits;
    roomSummary.storageWriteUnits += storageWriteUnits;
    roomSummary.rowsRead += rowsRead;
    roomSummary.rowsWritten += rowsWritten;
  }

  for (const row of invocations) {
    if (!shouldIncludeNamespace(row.dimensions.namespaceId)) continue;
    const bucket = row.dimensions.datetimeFiveMinutes ?? null;
    const room = row.dimensions.name ?? "(unknown)";
    const split = splitForBucket(bucket, deployAtMs);
    const splitTotals = totals[split];
    const requests = numberValue(row.sum.requests);
    const errors = numberValue(row.sum.errors);
    const wallTime = numberValue(row.sum.wallTime);
    const type = `${row.dimensions.type ?? "unknown"}:${row.dimensions.status ?? "unknown"}`;

    splitTotals.invocations += requests;
    splitTotals.errors += errors;
    splitTotals.wallTime += wallTime;
    splitTotals.byType[type] = (splitTotals.byType[type] ?? 0) + requests;

    const roomSummary = ensureRoom(room, row.dimensions.namespaceId);
    roomSummary.invocations += requests;
    roomSummary.errors += errors;
    roomSummary.invocationTypes[type] =
      (roomSummary.invocationTypes[type] ?? 0) + requests;
  }

  const roomRows = [...rooms.values()].sort(
    (left, right) => right.durationSec - left.durationSec,
  );
  const totalDurationSec = roomRows.reduce(
    (sum, row) => sum + row.durationSec,
    0,
  );
  const percentage = (value: number) =>
    totalDurationSec > 0 ? round((value / totalDurationSec) * 100, 1) : 0;
  const topShare = (count: number) =>
    percentage(
      roomRows.slice(0, count).reduce((sum, row) => sum + row.durationSec, 0),
    );

  const preTotals = compactTotals(totals.pre, windowStart, deployAt);
  const postTotals = compactTotals(totals.post, deployAt, windowEnd);

  return {
    windowStart,
    deployAt,
    windowEnd,
    sourceRows: {
      periodic: periodic.length,
      invocations: invocations.length,
      queryLimit: normalizedQueryLimit,
      periodicLimitReached:
        normalizedQueryLimit !== null && periodic.length >= normalizedQueryLimit,
      invocationLimitReached:
        normalizedQueryLimit !== null &&
        invocations.length >= normalizedQueryLimit,
    },
    namespace,
    totals: {
      pre: preTotals,
      post: postTotals,
    },
    comparison: buildComparison(preTotals, postTotals, deployAt, windowEnd),
    concentration: {
      roomCount: roomRows.length,
      totalDurationSec,
      top1Pct: topShare(1),
      top5Pct: topShare(5),
      top10Pct: topShare(10),
    },
    topRooms: roomRows.slice(0, topRoomLimit).map((row) => ({
      ...row,
      sharePct: percentage(row.durationSec),
    })),
  };
};
