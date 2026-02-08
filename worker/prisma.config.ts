import path from "node:path";
import "dotenv/config";

export default {
  earlyAccess: true,
  schema: path.join(__dirname, "..", "prisma", "schema.prisma"),
};
