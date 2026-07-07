import cron from "node-cron";
import { SchedulerService } from "@/services/scheduler";
import { logger } from "@/lib/logger";

declare global {
  var isCronStarted: boolean | undefined;
}

export function startBackgroundJobs() {
  if (globalThis.isCronStarted) {
    logger.info("Background Cron scheduler already active. Skipping setup.");
    return;
  }
  
  // Guard for Next.js dev server double starts and edge runtimes
  if (typeof window !== "undefined" || process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  globalThis.isCronStarted = true;
  logger.info("Initializing node-cron background jobs scheduler...");

  // Run check loop every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    logger.info("Background Cron trigger: Running active checks...");
    try {
      await SchedulerService.runActiveChecks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(`Background job run exception: ${message}`);
    }
  });

  // Also run a bootstrap check after server stabilizes (10 seconds)
  setTimeout(async () => {
    logger.info("Running bootstrap check cycle...");
    try {
      await SchedulerService.runActiveChecks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(`Bootstrap check cycle exception: ${message}`);
    }
  }, 10000);
}
