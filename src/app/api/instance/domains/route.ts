import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const MAX_DOMAINS_PER_INSTANCE = 5;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const instance = await prisma.instance.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!instance) {
    return NextResponse.json({ domains: [] });
  }

  const domains = await prisma.customDomain.findMany({
    where: { instanceId: instance.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ domains });
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { domain, siteSlug } = await req.json();

    // Validate domain
    const normalizedDomain = domain?.toLowerCase()?.trim();
    if (!normalizedDomain || !DOMAIN_RE.test(normalizedDomain)) {
      return NextResponse.json(
        { error: "Invalid domain format" },
        { status: 400 }
      );
    }

    if (normalizedDomain.endsWith(".instaclaw.bot")) {
      return NextResponse.json(
        { error: "Cannot use instaclaw.bot subdomains" },
        { status: 400 }
      );
    }

    if (!siteSlug || typeof siteSlug !== "string") {
      return NextResponse.json(
        { error: "Site slug is required" },
        { status: 400 }
      );
    }

    const instance = await prisma.instance.findUnique({
      where: { userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!instance || instance.status !== "active") {
      return NextResponse.json(
        { error: "No active instance" },
        { status: 400 }
      );
    }

    // Check domain limit
    const count = await prisma.customDomain.count({
      where: { instanceId: instance.id },
    });
    if (count >= MAX_DOMAINS_PER_INSTANCE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_DOMAINS_PER_INSTANCE} custom domains allowed` },
        { status: 400 }
      );
    }

    // Check uniqueness
    const existing = await prisma.customDomain.findUnique({
      where: { domain: normalizedDomain },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This domain is already in use" },
        { status: 409 }
      );
    }

    const record = await prisma.customDomain.create({
      data: {
        domain: normalizedDomain,
        siteSlug,
        instanceId: instance.id,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("Create custom domain error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json({ error: "Domain required" }, { status: 400 });
    }

    const instance = await prisma.instance.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!instance) {
      return new NextResponse("Not found", { status: 404 });
    }

    const record = await prisma.customDomain.findFirst({
      where: { domain: domain.toLowerCase(), instanceId: instance.id },
    });

    if (!record) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    await prisma.customDomain.delete({ where: { id: record.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete custom domain error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
