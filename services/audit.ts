import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export class AuditService {
  static async log(userId: string, action: string, metadata?: unknown) {
    try {
      return await db.auditLog.create({
        data: {
          userId,
          action,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
      });
    } catch (error) {
      logger.error(`Failed to write audit log [${action}] for user [${userId}]:`, error);
    }
  }
}
