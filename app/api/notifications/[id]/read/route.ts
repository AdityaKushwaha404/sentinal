import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/services/user";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  try {
    const notification = await db.notification.updateMany({
      where: { id, userId: user.id },
      data: { isRead: true },
    });

    if (notification.count === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
