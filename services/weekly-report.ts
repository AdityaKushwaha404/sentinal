import { db } from "@/lib/prisma";
import { EmailService } from "@/services/emails";
import { AiWeeklyReportService } from "@/services/ai/weekly-report";
import { logger } from "@/lib/logger";
import { env } from "@/config/env";

export class WeeklyReportService {
  static async generateAndSendReports(): Promise<void> {
    if (!env.ENABLE_WEEKLY_REPORT) {
      logger.info("Weekly report generation is disabled via environment configuration.");
      return;
    }

    logger.info("Executing weekly infrastructure report generation process...");

    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Find all users in the system to compile weekly summaries
      const users = await db.user.findMany({
        include: {
          settings: true,
        },
      });

      for (const user of users) {
        // Skip users with email notification disabled
        if (user.settings && !user.settings.emailNotifications) {
          logger.info(`Skipping weekly report for user ${user.email} (Email notifications disabled)`);
          continue;
        }

        // Get user's monitors
        const monitors = await db.monitor.findMany({
          where: { userId: user.id },
          include: {
            checks: {
              where: {
                checkedAt: {
                  gte: oneWeekAgo,
                  lte: now,
                },
              },
            },
            incidents: {
              where: {
                startedAt: {
                  gte: oneWeekAgo,
                  lte: now,
                },
              },
            },
          },
        });

        if (monitors.length === 0) {
          logger.info(`No monitors found for user ${user.email}. Skipping weekly report.`);
          continue;
        }

        // Compile metrics
        let totalChecksCount = 0;
        let successfulChecksCount = 0;
        let totalLatencySum = 0;
        let totalIncidentsCount = 0;
        let totalDowntimeDurationMs = BigInt(0);

        let fastestMonitorName = "N/A";
        let fastestLatency = Infinity;
        let slowestMonitorName = "N/A";
        let slowestLatency = -Infinity;

        let mostUnstableMonitorName = "N/A";
        let maxIncidents = -1;
        let mostReliableMonitorName = "N/A";
        let maxUptimeRatio = -1;

        for (const monitor of monitors) {
          const checks = monitor.checks;
          totalIncidentsCount += monitor.incidents.length;

          // Uptime ratio for this monitor
          const monitorChecksCount = checks.length;
          const monitorSuccessfulCount = checks.filter(c => c.isAvailable).length;
          const monitorUptimeRatio = monitorChecksCount > 0 
            ? (monitorSuccessfulCount / monitorChecksCount) * 100 
            : 100;

          if (monitorUptimeRatio > maxUptimeRatio) {
            maxUptimeRatio = monitorUptimeRatio;
            mostReliableMonitorName = monitor.name;
          }

          if (monitor.incidents.length > maxIncidents) {
            maxIncidents = monitor.incidents.length;
            mostUnstableMonitorName = monitor.name;
          }

          // Downtime accumulation
          for (const incident of monitor.incidents) {
            const end = incident.resolvedAt ? new Date(incident.resolvedAt) : now;
            const start = new Date(incident.startedAt);
            totalDowntimeDurationMs += BigInt(end.getTime() - start.getTime());
          }

          // Latency profile
          for (const check of checks) {
            totalChecksCount++;
            if (check.isAvailable) {
              successfulChecksCount++;
              totalLatencySum += check.responseTime;

              if (check.responseTime < fastestLatency) {
                fastestLatency = check.responseTime;
                fastestMonitorName = monitor.name;
              }
              if (check.responseTime > slowestLatency) {
                slowestLatency = check.responseTime;
                slowestMonitorName = monitor.name;
              }
            }
          }
        }

        const overallUptime = totalChecksCount > 0 
          ? Number(((successfulChecksCount / totalChecksCount) * 100).toFixed(2))
          : 100;

        const averageLatency = successfulChecksCount > 0 
          ? Number((totalLatencySum / successfulChecksCount).toFixed(1))
          : 0;

        // SSL Certificates warning count
        const sslExpiringCount = await db.sSLCertificate.count({
          where: {
            monitor: { userId: user.id },
            status: "EXPIRING_SOON",
          },
        });

        const downtimeDurationStr = totalDowntimeDurationMs > 0
          ? `${Math.round(Number(totalDowntimeDurationMs) / 60000)} minutes`
          : "0 seconds";

        // Query Gemini AI
        let aiExecutiveSummary = "Weekly check cycle completed successfully. All infrastructure modules are running.";
        let aiHealthAnalysis = "N/A";
        let aiKeyFindings = "N/A";
        let aiRiskAnalysis = "N/A";
        let aiRecommendations = "No critical actions recommended at this time.";
        let aiPriorityActions = "Monitor active statuses normally.";

        if (env.ENABLE_AI) {
          const aiReport = await AiWeeklyReportService.generateReport({
            startDate: oneWeekAgo.toLocaleDateString(),
            endDate: now.toLocaleDateString(),
            overallUptime,
            totalIncidents: totalIncidentsCount,
            averageLatency,
            fastestMonitorName,
            slowestMonitorName,
            unstableMonitorName: mostUnstableMonitorName,
            reliableMonitorName: mostReliableMonitorName,
            downtimeDuration: downtimeDurationStr,
            sslExpiringCount,
          });

          if (aiReport) {
            aiExecutiveSummary = aiReport.executiveSummary;
            aiHealthAnalysis = aiReport.healthAnalysis;
            aiKeyFindings = aiReport.keyFindings;
            aiRiskAnalysis = aiReport.riskAnalysis;
            aiRecommendations = aiReport.recommendations;
            aiPriorityActions = aiReport.priorityActions;
          }
        }

        // Store weekly report in database
        const weeklyReport = await db.weeklyReport.create({
          data: {
            userId: user.id,
            startDate: oneWeekAgo,
            endDate: now,
            uptimeRatio: overallUptime,
            totalIncidents: totalIncidentsCount,
            averageLatency,
            fastestMonitorName,
            slowestMonitorName,
            unstableMonitorName: mostUnstableMonitorName,
            reliableMonitorName: mostReliableMonitorName,
            downtimeDurationMs: totalDowntimeDurationMs,
            sslExpiringCount,
            aiExecutiveSummary,
            aiHealthAnalysis,
            aiKeyFindings,
            aiRiskAnalysis,
            aiRecommendations,
            aiPriorityActions,
          },
        });

        // Dispatch Email Report via Resend
        await EmailService.sendWeeklyReport(user.email, {
          startDate: oneWeekAgo.toLocaleDateString(),
          endDate: now.toLocaleDateString(),
          uptimeRatio: overallUptime,
          totalIncidents: totalIncidentsCount,
          averageLatency,
          fastestMonitorName,
          slowestMonitorName,
          unstableMonitorName: mostUnstableMonitorName,
          reliableMonitorName: mostReliableMonitorName,
          downtimeDuration: downtimeDurationStr,
          sslExpiringCount,
          aiExecutiveSummary,
          aiHealthAnalysis,
          aiRiskAnalysis,
          aiRecommendations,
          aiPriorityActions,
        });

        logger.info(`Generated and sent weekly health report to ${user.email}. DB Report ID: ${weeklyReport.id}`);
      }
    } catch (error) {
      logger.error("Weekly report generation cycle failed:", error);
    }
  }
}
