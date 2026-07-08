import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// GET: List all sessions
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const sessions = await db.assistantSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(sessions);
  } catch (error) {
    logger.error("Failed to list assistant sessions:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// POST: Create a new session
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { title } = await req.json();
    const session = await db.assistantSession.create({
      data: {
        userId,
        title: title?.trim() || "New Chat Session",
      },
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    logger.error("Failed to create assistant session:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
