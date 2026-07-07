import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Verify ownership
  const monitor = await db.monitor.findFirst({
    where: { id, userId },
  });

  if (!monitor) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const checks = await db.monitorCheck.findMany({
    where: { monitorId: id },
    orderBy: { checkedAt: "desc" },
    take: limit,
  });

  return NextResponse.json(checks);
}
