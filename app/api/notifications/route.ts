import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/services/user";

export async function GET(req: Request) {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "30", 10);

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { sentAt: "desc" },
      take: Math.min(limit, 100),
      include: {
        monitor: {
          select: { name: true, slug: true, type: true },
        },
      },
    }),
    db.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
