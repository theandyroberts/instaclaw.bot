import type Redis from "ioredis";

// Prisma client type — accepts any PrismaClient instance (avoids dual-path import issue)
type PrismaClient = {
  $queryRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
};

const POOL_MIN_SIZE = parseInt(process.env.POOL_MIN_SIZE || "2");

interface PoolTargetResult {
  target: number;
  debug: {
    mode: "static" | "dynamic";
    hour: number;
    lookaheadHour: number;
    dayType: "weekday" | "weekend";
    expectedDemand: number;
    surgeActive: boolean;
    previousTarget: number | null;
    decayCapped: boolean;
  };
}

/**
 * Compute the dynamic pool target size based on historical demand patterns.
 *
 * Falls back gracefully: DB failure → POOL_MIN_SIZE, Redis failure → skip surge/decay.
 */
export async function computePoolTarget(
  prisma: PrismaClient,
  redis: Redis,
  now?: Date
): Promise<PoolTargetResult> {
  // Static override: if POOL_TARGET_SIZE is explicitly set, use it
  if (process.env.POOL_TARGET_SIZE) {
    const staticTarget = parseInt(process.env.POOL_TARGET_SIZE);
    return {
      target: staticTarget,
      debug: {
        mode: "static",
        hour: 0,
        lookaheadHour: 0,
        dayType: "weekday",
        expectedDemand: 0,
        surgeActive: false,
        previousTarget: null,
        decayCapped: false,
      },
    };
  }

  const timestamp = now || new Date();
  const utcHour = timestamp.getUTCHours();
  const utcDay = timestamp.getUTCDay();
  const isWeekend = utcDay === 0 || utcDay === 6;
  const lookaheadHour = (utcHour + 1) % 24;
  const dayType = isWeekend ? "weekend" : "weekday";

  // Query historical demand for the lookahead hour
  let expectedDemand = 0;
  try {
    expectedDemand = await queryHistoricalDemand(prisma, lookaheadHour, isWeekend);
  } catch (err) {
    console.error("[pool-target] DB query failed, using floor:", err instanceof Error ? err.message : err);
    return {
      target: POOL_MIN_SIZE,
      debug: {
        mode: "dynamic",
        hour: utcHour,
        lookaheadHour,
        dayType,
        expectedDemand: 0,
        surgeActive: false,
        previousTarget: null,
        decayCapped: false,
      },
    };
  }

  // Buffer + floor
  let target = Math.max(Math.ceil(expectedDemand * 1.2), POOL_MIN_SIZE);

  // Surge boost
  let surgeActive = false;
  try {
    const surgeUntil = await redis.get("pool:surge:active_until");
    if (surgeUntil && parseInt(surgeUntil) > timestamp.getTime()) {
      surgeActive = true;
      target += 2;
    }
  } catch (err) {
    console.error("[pool-target] Redis surge check failed, skipping:", err instanceof Error ? err.message : err);
  }

  // Slow decay: allow at most -1 per cycle when scaling down
  let previousTarget: number | null = null;
  let decayCapped = false;
  try {
    const prev = await redis.get("pool:target:previous");
    if (prev !== null) {
      previousTarget = parseInt(prev);
      if (target < previousTarget) {
        target = previousTarget - 1;
        decayCapped = true;
      }
    }
    // Store current target with 30min TTL
    await redis.set("pool:target:previous", target.toString(), "EX", 1800);
  } catch (err) {
    console.error("[pool-target] Redis decay check failed, skipping:", err instanceof Error ? err.message : err);
  }

  // Ensure we never go below floor after decay
  target = Math.max(target, POOL_MIN_SIZE);

  return {
    target,
    debug: {
      mode: "dynamic",
      hour: utcHour,
      lookaheadHour,
      dayType,
      expectedDemand,
      surgeActive,
      previousTarget,
      decayCapped,
    },
  };
}

/**
 * Query average instances created per hour-of-day over the last 14 days,
 * split by weekday/weekend.
 */
async function queryHistoricalDemand(
  prisma: PrismaClient,
  hour: number,
  isWeekend: boolean
): Promise<number> {
  // Build day-of-week filter: weekend = 0,6 (Sunday, Saturday in EXTRACT DOW)
  const dowFilter = isWeekend ? "IN (0, 6)" : "NOT IN (0, 6)";

  const result: Array<{ avg_count: number | null }> = await prisma.$queryRawUnsafe(`
    SELECT AVG(daily_count)::float AS avg_count
    FROM (
      SELECT DATE("createdAt") AS day, COUNT(*) AS daily_count
      FROM instances
      WHERE "createdAt" >= NOW() - INTERVAL '14 days'
        AND EXTRACT(HOUR FROM "createdAt") = $1
        AND EXTRACT(DOW FROM "createdAt") ${dowFilter}
      GROUP BY DATE("createdAt")
    ) sub
  `, hour);

  return result[0]?.avg_count ?? 0;
}

/**
 * Track when the pool hits zero ready droplets and activate surge mode
 * if it happens repeatedly.
 *
 * Call this from pool-maintain after counting ready droplets.
 */
export async function checkAndRecordPoolEmpty(
  redis: Redis,
  readyCount: number,
  now?: Date
): Promise<void> {
  if (readyCount > 0) return;

  const timestamp = now || new Date();
  const nowMs = timestamp.getTime();

  try {
    // Record this zero event
    await redis.zadd("pool:surge:zeros", nowMs, nowMs.toString());

    // Prune entries older than 1 hour
    const oneHourAgo = nowMs - 60 * 60 * 1000;
    await redis.zremrangebyscore("pool:surge:zeros", "-inf", oneHourAgo);

    // Count zeros in the last hour
    const zeroCount = await redis.zcard("pool:surge:zeros");

    // If 2+ zeros in the last hour, activate surge
    if (zeroCount >= 2) {
      const surgeUntil = nowMs + 4 * 60 * 60 * 1000; // 4 hours from now
      await redis.set("pool:surge:active_until", surgeUntil.toString());
      console.log(`[pool-target] Surge activated: ${zeroCount} pool-empty events in last hour, active until ${new Date(surgeUntil).toISOString()}`);
    }
  } catch (err) {
    console.error("[pool-target] Redis surge recording failed, skipping:", err instanceof Error ? err.message : err);
  }
}
