import { Queue } from "bullmq";
import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 60000,
  },
  removeOnComplete: 50,
  removeOnFail: 20,
};

export const provisionQueue = new Queue("provision", {
  connection: redis,
  defaultJobOptions,
});

export const configureQueue = new Queue("configure", {
  connection: redis,
  defaultJobOptions,
});

export const lifecycleQueue = new Queue("lifecycle", {
  connection: redis,
  defaultJobOptions,
});

export const healthQueue = new Queue("health", {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1,
    removeOnComplete: 10,
  },
});

export const poolQueue = new Queue("pool", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential" as const, delay: 60000 },
    removeOnComplete: 20,
    removeOnFail: 10,
  },
});
