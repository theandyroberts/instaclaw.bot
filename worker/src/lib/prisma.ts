import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Dynamic import to handle different generated client locations
// On worker droplet: ./src/generated/prisma
// In monorepo: ../src/generated/prisma (platform's generated client)
let PrismaClient: any;
try {
  PrismaClient = require("../generated/prisma").PrismaClient;
} catch {
  PrismaClient = require("../../src/generated/prisma").PrismaClient;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
