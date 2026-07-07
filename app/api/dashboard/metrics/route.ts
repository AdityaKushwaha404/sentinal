import { NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analytics";
import { logger } from "@/lib/logger";

import { getOrCreateCurrentUser } from "@/services/user";

export async function GET() {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const metrics = await AnalyticsService.getDashboardMetrics(user.id);
    return NextResponse.json(metrics);
  } catch (error) {
    logger.error("Failed to fetch dashboard metrics:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
