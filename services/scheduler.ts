import { db } from "@/lib/prisma";
import { checkHttp, checkTcp, checkSsl, checkJsonApi, checkPing, getHostname } from "@/utils/ping";
import { EmailService } from "./emails";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { env } from "@/config/env";

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

    const monitorType = monitor.type || "HTTP";
    const timeoutMs = monitor.timeoutMs ?? 30000;

    // Parse headers stored as JSON
    let parsedHeaders: Record<string, string> = {};
    if (monitor.httpHeaders && typeof monitor.httpHeaders === "object" && !Array.isArray(monitor.httpHeaders)) {
      parsedHeaders = monitor.httpHeaders as Record<string, string>;
    }

    // 1. Perform check based on type
    if (monitorType === "TCP") {
      const hostname = getHostname(monitor.url);
      const port = monitor.tcpPort ?? parseInt(monitor.url.split(":").pop() ?? "80", 10);
      const res = await checkTcp(hostname, isNaN(port) ? 80 : port, timeoutMs);
      isAvailable = res.isAvailable;
      responseTime = res.responseTime;
      statusCode = res.statusCode;
      errorMessage = res.errorMessage;
    } else if (monitorType === "PING") {
      const hostname = getHostname(monitor.url);
      const port = monitor.tcpPort ?? 80;
      const res = await checkPing(hostname, port, timeoutMs);
      isAvailable = res.isAvailable;
      responseTime = res.responseTime;
      statusCode = res.statusCode;
      errorMessage = res.errorMessage;
    } else if (monitorType === "JSON_API") {
      const res = await checkJsonApi(monitor.url, {
        method: monitor.httpMethod ?? "GET",
        headers: parsedHeaders,
        timeoutMs,
        expectedStatusCode: monitor.expectedStatusCode ?? 200,
        jsonPath: monitor.jsonPath ?? undefined,
        jsonPathExpected: monitor.jsonPathExpected ?? undefined,
      });
      isAvailable = res.isAvailable;
      responseTime = res.responseTime;
      statusCode = res.statusCode;
      errorMessage = res.errorMessage;
    } else {
      // HTTP, HTTPS, SSL — all go through checkHttp
      const res = await checkHttp(monitor.url, {
        method: monitor.httpMethod ?? "GET",
        headers: parsedHeaders,
        timeoutMs,
        expectedStatusCode: monitor.expectedStatusCode ?? undefined,
      });
      isAvailable = res.isAvailable;
      responseTime = res.responseTime;
      statusCode = res.statusCode;
      errorMessage = res.errorMessage;
    }

    // 2. SSL certificate check for HTTPS and SSL types
    let sslCertInfo = null;
    const isHttps = monitor.url.startsWith("https://");
    if (isHttps || monitorType === "SSL") {
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

    // 4. Persist MonitorCheck record
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

    // Update Monitor status and timestamps
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
      const certStatusMapping =
        sslCertInfo.status === "EXPIRING" ? "EXPIRING_SOON" : sslCertInfo.status;
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
      const title = `Downtime Incident: ${monitor.name} is Offline`;
      const description =
        errorMessage ||
        "The monitor returned an offline status or connection parameters failed.";

      const openIncident = await db.incident.findFirst({
        where: { monitorId: monitor.id, status: "OPEN" },
      });

      if (!openIncident) {
        const createdIncident = await db.incident.create({
          data: {
            monitorId: monitor.id,
            status: "OPEN",
            title,
            description,
            startedAt: new Date(),
          },
        });

        const userEmail = monitor.user?.email || monitor.user?.id;
        
        // Asynchronously process Gemini AI summary and email dispatch to keep prober cycle non-blocking
        (async () => {
          try {
            let aiSummaryData: {
              summary: string;
              likelyCause: string;
              actions: string;
              confidence: number;
            } | undefined = undefined;

            if (env.ENABLE_AI) {
              // 1. Gather context details
              const [recentChecks, recentIncidents] = await Promise.all([
                db.monitorCheck.findMany({
                  where: { monitorId: monitor.id },
                  orderBy: { checkedAt: "desc" },
                  take: 5,
                }),
                db.incident.findMany({
                  where: { monitorId: monitor.id },
                  orderBy: { startedAt: "desc" },
                  take: 3,
                }),
              ]);

              const sslInfo = await db.sSLCertificate.findUnique({
                where: { monitorId: monitor.id },
              });

              const latencyTrendStr = recentChecks.map(c => `${c.responseTime}ms (code ${c.statusCode || "N/A"})`).join(", ");
              const incidentHistoryStr = recentIncidents.map(i => `${i.title} (${i.status})`).join(", ");

              const { AiIncidentService } = await import("@/services/ai/incident");
              const aiAnalysis = await AiIncidentService.generateSummary({
                monitorName: monitor.name,
                monitorType: monitorType,
                targetUrl: monitor.url,
                currentStatus: "DOWN",
                previousStatus: String(previousStatus),
                responseTime,
                responseCode: String(statusCode || "N/A"),
                failureReason: description,
                sslStatus: sslInfo ? `${sslInfo.status} (Exp: ${sslInfo.expiryDate})` : "N/A",
                recentLatencyTrend: latencyTrendStr || "No recent check history",
                recentIncidentHistory: incidentHistoryStr || "No recent incident history",
              });

              if (aiAnalysis) {
                // Update incident record in database
                await db.incident.update({
                  where: { id: createdIncident.id },
                  data: {
                    aiSummary: aiAnalysis.summary,
                    aiLikelyCause: aiAnalysis.likelyCauses.join(", "),
                    aiRecommendedActions: aiAnalysis.recommendedActions.join(", "),
                    aiConfidenceScore: aiAnalysis.confidence,
                    aiGeneratedAt: new Date(),
                  },
                });

                aiSummaryData = {
                  summary: aiAnalysis.summary,
                  likelyCause: aiAnalysis.likelyCauses.join(", "),
                  actions: aiAnalysis.recommendedActions.join(", "),
                  confidence: aiAnalysis.confidence,
                };
              }
            }

            if (userEmail && monitor.user?.settings?.emailNotifications) {
              await EmailService.sendAlert(userEmail, monitor.name, monitor.url, description, aiSummaryData);
            }
          } catch (aiErr) {
            logger.error("AI Incident Summary background processing crashed:", aiErr);
            // Fallback to standard email alert if AI processing crashes or fails
            if (userEmail && monitor.user?.settings?.emailNotifications) {
              try {
                await EmailService.sendAlert(userEmail, monitor.name, monitor.url, description);
              } catch (emailErr) {
                logger.error("Standard fallback email dispatch failed:", emailErr);
              }
            }
          }
        })();

        // Create in-app notification
        await db.notification.create({
          data: {
            userId: monitor.userId,
            monitorId: monitor.id,
            type: "DOWNTIME_ALERT",
            title: `🔴 ${monitor.name} is down`,
            message: description,
            sentTo: monitor.user?.email ?? "",
            isRead: false,
          },
        });
      }
    } else if (previousStatus === "DOWN" && finalStatus === "HEALTHY") {
      const openIncident = await db.incident.findFirst({
        where: { monitorId: monitor.id, status: "OPEN" },
        orderBy: { startedAt: "desc" },
      });

      if (openIncident) {
        const resolvedAt = new Date();
        await db.incident.update({
          where: { id: openIncident.id },
          data: { status: "RESOLVED", resolvedAt },
        });

        const diffMs = resolvedAt.getTime() - new Date(openIncident.startedAt).getTime();
        const diffMins = Math.round(diffMs / 60000);
        const durationStr =
          diffMins > 0 ? `${diffMins} minutes` : `${Math.round(diffMs / 1000)} seconds`;

        const userEmail = monitor.user?.email || monitor.user?.id;
        if (userEmail && monitor.user?.settings?.emailNotifications) {
          await EmailService.sendRecovery(userEmail, monitor.name, monitor.url, durationStr);
        }

        // Create in-app notification
        await db.notification.create({
          data: {
            userId: monitor.userId,
            monitorId: monitor.id,
            type: "UPTIME_RECOVERY",
            title: `✅ ${monitor.name} recovered`,
            message: `Monitor is back online after ${durationStr} of downtime.`,
            sentTo: monitor.user?.email ?? "",
            isRead: false,
          },
        });
      }
    }

    // 6. SSL certificate warnings
    if (
      sslCertInfo &&
      sslCertInfo.status === "EXPIRING" &&
      monitor.user?.settings?.emailNotifications
    ) {
      const lastWarning = await db.notification.findFirst({
        where: {
          monitorId: monitor.id,
          type: "SSL_EXPIRING_WARNING",
          sentAt: {
            gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (!lastWarning) {
        const userEmail = monitor.user?.email || monitor.user?.id;
        if (userEmail) {
          await EmailService.sendSSLExpiring(
            userEmail,
            monitor.name,
            monitor.url,
            sslCertInfo.remainingDays,
            sslCertInfo.expiryDate
          );

          await db.notification.create({
            data: {
              userId: monitor.userId,
              monitorId: monitor.id,
              type: "SSL_EXPIRING_WARNING",
              title: `⚠️ SSL expiring: ${monitor.name}`,
              message: `SSL certificate expires in ${sslCertInfo.remainingDays} day(s).`,
              sentTo: userEmail,
              isRead: false,
            },
          });
        }
      }
    }
  }
}
