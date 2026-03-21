import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listSites, deleteSite } from "@/lib/worker-client";
import { NextRequest, NextResponse } from "next/server";

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

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteName } = await req.json();
  if (!siteName || typeof siteName !== "string") {
    return NextResponse.json({ error: "Missing siteName" }, { status: 400 });
  }

  const instance = await prisma.instance.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, instanceName: true },
  });

  if (!instance || instance.status !== "active" || !instance.instanceName) {
    return NextResponse.json({ error: "Instance not available" }, { status: 404 });
  }

  const success = await deleteSite(instance.id, siteName);
  if (!success) {
    return NextResponse.json({ error: "Failed to delete site" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
