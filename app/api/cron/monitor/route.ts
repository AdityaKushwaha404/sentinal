import { NextResponse } from "next/server";
import { SchedulerService } from "@/services/scheduler";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  // Optional: Verify request against a secret key if set in environment
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized request attempt to cron endpoint");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const triggerWeekly = url.searchParams.get("report") === "weekly";

  try {
    if (triggerWeekly) {
      const { WeeklyReportService } = await import("@/services/weekly-report");
      await WeeklyReportService.generateAndSendReports();
      return NextResponse.json({ success: true, message: "Weekly infrastructure reports compiled and dispatched." });
    } else {
      await SchedulerService.runActiveChecks();
      return NextResponse.json({ success: true, message: "Uptime checks executed." });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Cron trigger execution failure: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
