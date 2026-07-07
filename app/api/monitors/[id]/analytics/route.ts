import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AnalyticsService } from "@/services/analytics";
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

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  try {
    const data = await AnalyticsService.getMonitorAnalytics(id, userId, days);
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Failed to fetch monitor analytics:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new NextResponse(message, { status: 500 });
  }
}
