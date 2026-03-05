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

export const configureTelegramQueue = new Queue("configure-telegram", {
  connection: redis,
  defaultJobOptions,
});

export const configureWorkspaceQueue = new Queue("configure-workspace", {
  connection: redis,
  defaultJobOptions,
});

export const updatePlanQueue = new Queue("update-plan", {
  connection: redis,
  defaultJobOptions,
});

export const suspendQueue = new Queue("suspend", {
  connection: redis,
  defaultJobOptions,
});

export const unsuspendQueue = new Queue("unsuspend", {
  connection: redis,
  defaultJobOptions,
});

export const terminateQueue = new Queue("terminate", {
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

export const auditQueue = new Queue("audit", {
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

export const poolAllocateQueue = new Queue("pool-allocate", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential" as const, delay: 60000 },
    removeOnComplete: 20,
    removeOnFail: 10,
  },
});

export const usageQueue = new Queue("usage", {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1,
    removeOnComplete: 10,
  },
});
