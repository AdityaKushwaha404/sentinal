import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// GET: Load chat messages for a specific session
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id } = await params;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const session = await db.assistantSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      return new NextResponse("Session not found", { status: 444 });
    }

    const messages = await db.assistantMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages);
  } catch (error) {
    logger.error("Failed to load chat messages:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PATCH: Rename a session
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id } = await params;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { title } = await req.json();
    if (!title || typeof title !== "string" || title.trim() === "") {
      return new NextResponse("Title is required", { status: 400 });
    }

    const session = await db.assistantSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      return new NextResponse("Session not found", { status: 444 });
    }

    const updated = await db.assistantSession.update({
      where: { id },
      data: { title: title.trim() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Failed to rename chat session:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE: Delete a session and its associated messages
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id } = await params;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const session = await db.assistantSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      return new NextResponse("Session not found", { status: 444 });
    }

    await db.assistantSession.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Failed to delete chat session:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
