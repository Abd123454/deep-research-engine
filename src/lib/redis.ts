// Redis client singleton — for distributed rate limiting in production.
// Returns null if REDIS_URL is not set (falls back to in-memory rate limiting).

import { Redis } from "ioredis";

let redisInstance: Redis | null = null;
let connectionFailed = false;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (connectionFailed) return null;
  if (!redisInstance) {
    try {
      redisInstance = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => Math.min(times * 500, 2000),
      });
      redisInstance.on("error", (err) => {
        console.warn("[redis] connection error:", err.message);
        connectionFailed = true;
      });
      redisInstance.on("connect", () => {
        connectionFailed = false;
      });
    } catch (err) {
      console.warn("[redis] init failed:", err instanceof Error ? err.message : String(err));
      connectionFailed = true;
      return null;
    }
  }
  return redisInstance;
}

export async function redisHealthCheck(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
