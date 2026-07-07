import { db } from "@/lib/prisma";
import { checkHttp, checkTcp, checkSsl, getHostname } from "@/utils/ping";
import { EmailService } from "./emails";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

type MonitorWithUser = Prisma.MonitorGetPayload<{
  include: {
    user: {
      include: {
        settings: true;
      };
    };
  };
}>;

export class SchedulerService {
  /**
   * Run a single check cycle for all active monitors
   */
  static async runActiveChecks() {
    logger.info("Starting active checks cycle...");
    try {
      const activeMonitors = await db.monitor.findMany({
        where: { isActive: true },
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
      });

      logger.info(`Found ${activeMonitors.length} active monitors to check.`);

      // Execute in parallel or sequentially depending on density. Let's do parallel processing with Promise.allSettled
      await Promise.allSettled(
        activeMonitors.map(async (monitor) => {
          try {
            await this.checkMonitor(monitor);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            logger.error(`Error checking monitor ${monitor.name} (${monitor.id}): ${message}`);
          }
        })
      );

      logger.info("Uptime check cycle completed successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Failed to execute active check cycle: ${message}`);
    }
  }

  /**
   * Run check for a specific monitor
   */
  static async checkMonitor(monitor: MonitorWithUser) {
    logger.info(`Checking monitor: ${monitor.name} (${monitor.url})`);

    let isAvailable = false;
    let responseTime = 0;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    const isHttps = monitor.url.startsWith("https://");

    // 1. Perform Uptime ping based on type
    if (monitor.type === "TCP") {
      const hostname = getHostname(monitor.url);
      const portStr = monitor.url.split(":")[2] || "80";
      const port = parseInt(portStr, 10);
      const res = await checkTcp(hostname, port);
      isAvailable = res.isAvailable;
      responseTime = res.responseTime;
      statusCode = res.statusCode;
      errorMessage = res.errorMessage;
    } else {
      // Default: HTTP/HTTPS
      const res = await checkHttp(monitor.url);
      isAvailable = res.isAvailable;
      responseTime = res.responseTime;
      statusCode = res.statusCode;
      errorMessage = res.errorMessage;
    }

    // 2. SSL certificate check if https is active
    let sslCertInfo = null;
    if (isHttps) {
      const hostname = getHostname(monitor.url);
      sslCertInfo = await checkSsl(hostname);
    }

    // 3. Compute final status
    let finalStatus: "HEALTHY" | "WARNING" | "DOWN" = isAvailable ? "HEALTHY" : "DOWN";
    if (isAvailable && sslCertInfo) {
      if (sslCertInfo.status === "EXPIRED") {
        finalStatus = "DOWN";
        errorMessage = errorMessage || "SSL certificate has expired";
      } else if (sslCertInfo.status === "EXPIRING") {
        finalStatus = "WARNING";
      }
    }

    const previousStatus = monitor.status;

    // 4. Update DB using sequential non-blocking updates
    // Create Check record
    await db.monitorCheck.create({
      data: {
        monitorId: monitor.id,
        statusCode,
        responseTime,
        isAvailable,
        errorMessage,
        checkedAt: new Date(),
      },
    });

    // Update Monitor status and stamps
    await db.monitor.update({
      where: { id: monitor.id },
      data: {
        status: finalStatus,
        lastCheckedAt: new Date(),
        lastOnlineAt: isAvailable ? new Date() : monitor.lastOnlineAt,
      },
    });

    // Write/Update SSL Cert details if applicable
    if (sslCertInfo) {
      const certStatusMapping = sslCertInfo.status === "EXPIRING" ? "EXPIRING_SOON" : sslCertInfo.status;
      await db.sSLCertificate.upsert({
        where: { monitorId: monitor.id },
        create: {
          monitorId: monitor.id,
          issuer: sslCertInfo.issuer,
          expiryDate: sslCertInfo.expiryDate,
          status: certStatusMapping,
        },
        update: {
          issuer: sslCertInfo.issuer,
          expiryDate: sslCertInfo.expiryDate,
          status: certStatusMapping,
        },
      });
    }

    // 5. Automatic Incident Management
    if (previousStatus === "HEALTHY" && finalStatus === "DOWN") {
      // Site went down! Create open incident
      const title = `Downtime Incident: ${monitor.name} is Offline`;
      const description = errorMessage || "The monitor returned an offline status or connection parameters failed.";
      
      const openIncident = await db.incident.findFirst({
        where: { monitorId: monitor.id, status: "OPEN" },
      });

      if (!openIncident) {
        await db.incident.create({
          data: {
            monitorId: monitor.id,
            status: "OPEN",
            title,
            description,
            startedAt: new Date(),
          },
        });

        // Trigger alert email to the user
        const userEmail = monitor.user?.email || monitor.user?.id; // fallback to ID/username/saved email
        if (userEmail && monitor.user?.settings?.emailNotifications) {
          await EmailService.sendAlert(userEmail, monitor.name, monitor.url, description);
        }
      }
    } else if (previousStatus === "DOWN" && finalStatus === "HEALTHY") {
      // Site recovered! Find any open incidents and resolve
      const openIncident = await db.incident.findFirst({
        where: { monitorId: monitor.id, status: "OPEN" },
        orderBy: { startedAt: "desc" },
      });

      if (openIncident) {
        const resolvedAt = new Date();
        await db.incident.update({
          where: { id: openIncident.id },
          data: {
            status: "RESOLVED",
            resolvedAt,
          },
        });

        // Calculate downtime duration
        const diffMs = resolvedAt.getTime() - new Date(openIncident.startedAt).getTime();
        const diffMins = Math.round(diffMs / 60000);
        const durationStr = diffMins > 0 ? `${diffMins} minutes` : `${Math.round(diffMs / 1000)} seconds`;

        // Trigger recovery email
        const userEmail = monitor.user?.email || monitor.user?.id;
        if (userEmail && monitor.user?.settings?.emailNotifications) {
          await EmailService.sendRecovery(userEmail, monitor.name, monitor.url, durationStr);
        }
      }
    }

    // 6. Handle SSL certificate warnings
    if (sslCertInfo && sslCertInfo.status === "EXPIRING" && monitor.user?.settings?.emailNotifications) {
      // Look for a recent notification record in last 7 days to avoid spamming
      const lastWarning = await db.notification.findFirst({
        where: {
          monitorId: monitor.id,
          type: "SSL_EXPIRING_WARNING",
          sentAt: {
            gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        },
      });

      if (!lastWarning) {
        const userEmail = monitor.user?.email || monitor.user?.id;
        if (userEmail) {
          await EmailService.sendSSLExpiring(userEmail, monitor.name, monitor.url, sslCertInfo.remainingDays, sslCertInfo.expiryDate);
          
          // Log dispatched alert
          await db.notification.create({
            data: {
              userId: monitor.userId,
              monitorId: monitor.id,
              type: "SSL_EXPIRING_WARNING",
              sentTo: userEmail,
            },
          });
        }
      }
    }
  }
}
