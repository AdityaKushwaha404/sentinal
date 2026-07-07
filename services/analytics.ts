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
      include: {
        sslCertificate: true,
      },
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

    // Group checks for latency charts
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

    // Calculate Percentiles: P50, P95, P99
    let p50 = 0;
    let p95 = 0;
    let p99 = 0;

    if (totalChecks > 0) {
      const sortedLatencies = [...checks].map((c) => c.responseTime).sort((a, b) => a - b);
      const getPercentile = (p: number) => {
        const index = Math.ceil((p / 100) * sortedLatencies.length) - 1;
        return sortedLatencies[Math.max(0, index)];
      };
      p50 = getPercentile(50);
      p95 = getPercentile(95);
      p99 = getPercentile(99);
    }

    // Daily Aggregated Availability Data
    const dailyMap: { [key: string]: { total: number; success: number } } = {};
    checks.forEach((c) => {
      const dateStr = c.checkedAt.toISOString().split("T")[0];
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { total: 0, success: 0 };
      }
      dailyMap[dateStr].total++;
      if (c.isAvailable) {
        dailyMap[dateStr].success++;
      }
    });

    const dailyAvailability = Object.keys(dailyMap).map((date) => {
      const day = dailyMap[date];
      return {
        date,
        uptime: Number(((day.success / day.total) * 100).toFixed(2)),
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Health Score calculation (0-100)
    // 60% weight to Uptime %, 25% to average response time (target < 500ms), 15% to SSL cert presence & validity
    let healthScore = 100;
    
    // Uptime impact
    const uptimePen = (100 - uptime) * 3; // e.g., 90% uptime = 30pt deduction
    healthScore -= uptimePen;

    // Latency impact: subtract points if avgLatency > 250ms
    if (avgLatency > 250) {
      const latencyPen = Math.min(25, (avgLatency - 250) / 10);
      healthScore -= latencyPen;
    }

    // SSL impact
    if (monitor.url.startsWith("https://") || monitor.type === "SSL") {
      if (!monitor.sslCertificate || monitor.sslCertificate.status !== "VALID") {
        healthScore -= 15;
      }
    }

    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    return {
      uptime,
      avgLatency,
      p50,
      p95,
      p99,
      dailyAvailability,
      healthScore,
      chartData,
    };
  }
}
