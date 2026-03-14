import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listSites } from "@/lib/worker-client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instance = await prisma.instance.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, instanceName: true },
  });

  if (!instance || instance.status !== "active" || !instance.instanceName) {
    return NextResponse.json({ sites: [] });
  }

  const sites = await listSites(instance.id);
  return NextResponse.json({ sites });
}
