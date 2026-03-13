import { prisma } from "../lib/prisma";
import { configureWorkspaceQueue } from "../queues";

async function main() {
  const instances = await prisma.instance.findMany({
    where: { status: "active" },
    include: { user: { select: { email: true } } },
  });

  console.log(`Found ${instances.length} active instances`);

  for (const inst of instances) {
    console.log(`Queuing reconfigure for ${inst.user.email} (${inst.id})`);
    await configureWorkspaceQueue.add(`reconfigure-${inst.id}`, {
      instanceId: inst.id,
    });
  }

  console.log("All jobs queued");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
