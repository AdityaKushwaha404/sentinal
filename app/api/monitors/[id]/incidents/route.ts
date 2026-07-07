import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { IncidentService } from "@/services/incident";
import { logger } from "@/lib/logger";

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
    const data = await IncidentService.listByMonitor(id, userId);
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Failed to fetch monitor incidents:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new NextResponse(message, { status: 500 });
  }
}
