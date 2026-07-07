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

  try {
    await SchedulerService.runActiveChecks();
    return NextResponse.json({ success: true, message: "Uptime checks executed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Cron trigger execution failure: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
