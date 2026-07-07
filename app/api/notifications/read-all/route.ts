import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/services/user";

export async function PATCH() {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  await db.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
