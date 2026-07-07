import { db } from "@/lib/prisma";

export class IncidentService {
  static async listByMonitor(monitorId: string, userId: string) {
    // Verify ownership
    const monitor = await db.monitor.findFirst({
      where: { id: monitorId, userId },
    });

    if (!monitor) {
      throw new Error("Monitor not found or access denied");
    }

    return await db.incident.findMany({
      where: { monitorId },
      orderBy: { startedAt: "desc" },
    });
  }

  static async getRecentIncidents(userId: string) {
    return await db.incident.findMany({
      where: {
        monitor: { userId },
      },
      include: {
        monitor: {
          select: { name: true, url: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    });
  }
}
