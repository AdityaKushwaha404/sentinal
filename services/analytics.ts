import { db } from "@/lib/prisma";
import { CheckStatus } from "@prisma/client";

export class AnalyticsService {
  static async getDashboardMetrics(userId: string) {
    const monitors = await db.monitor.findMany({
      where: { userId },
      include: {
        checks: {
          take: 100, // Look at recent checks for metrics
          orderBy: { checkedAt: "desc" },
        },
      },
    });

    const total = monitors.length;
    const healthy = monitors.filter((m) => m.status === CheckStatus.HEALTHY).length;
    const warning = monitors.filter((m) => m.status === CheckStatus.WARNING).length;
    const offline = monitors.filter((m) => m.status === CheckStatus.DOWN).length;

    // Calculate Average Response Time and Uptime across recent checks
    let totalChecksCount = 0;
    let availableChecksCount = 0;
    let sumResponseTime = 0;
    let hasChecks = false;

    for (const monitor of monitors) {
      if (monitor.checks.length > 0) {
        hasChecks = true;
        for (const check of monitor.checks) {
          totalChecksCount++;
          if (check.isAvailable) {
            availableChecksCount++;
          }
          sumResponseTime += check.responseTime;
        }
      }
    }

    const avgResponseTime = totalChecksCount > 0 ? Math.round(sumResponseTime / totalChecksCount) : 0;
    const uptimePercentage = totalChecksCount > 0 ? Number(((availableChecksCount / totalChecksCount) * 100).toFixed(2)) : 100.0;

    return {
      total,
      healthy,
      warning,
      offline,
      avgResponseTime,
      uptimePercentage: hasChecks ? uptimePercentage : 100.0,
    };
  }

  static async getMonitorAnalytics(monitorId: string, userId: string, days = 7) {
    // Verify monitor belongs to user
    const monitor = await db.monitor.findFirst({
      where: { id: monitorId, userId },
    });

    if (!monitor) {
      throw new Error("Monitor not found or access denied");
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch checks within timeframe
    const checks = await db.monitorCheck.findMany({
      where: {
        monitorId,
        checkedAt: { gte: startDate },
      },
      orderBy: { checkedAt: "asc" },
    });

    // Group checks for latency charts (e.g. by hour or directly if low count)
    const chartData = checks.map((c) => ({
      timestamp: c.checkedAt.toISOString(),
      responseTime: c.responseTime,
      isAvailable: c.isAvailable ? 1 : 0,
      statusCode: c.statusCode,
    }));

    // Calculate metrics for this specific monitor
    const totalChecks = checks.length;
    const successfulChecks = checks.filter((c) => c.isAvailable).length;
    const uptime = totalChecks > 0 ? Number(((successfulChecks / totalChecks) * 100).toFixed(2)) : 100.0;
    const avgLatency = totalChecks > 0 ? Math.round(checks.reduce((acc, c) => acc + c.responseTime, 0) / totalChecks) : 0;

    return {
      uptime,
      avgLatency,
      chartData,
    };
  }
}
