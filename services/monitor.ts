import { db } from "@/lib/prisma";
import { CheckStatus, Prisma } from "@prisma/client";
import { AuditService } from "./audit";

export interface CreateMonitorInput {
  userId: string;
  name: string;
  url: string;
  type: string;
  monitorInterval: number;
  tags?: string[];
  // Type-specific config
  httpMethod?: string;
  httpHeaders?: Record<string, string>;
  timeoutMs?: number;
  expectedStatusCode?: number;
  jsonPath?: string;
  jsonPathExpected?: string;
  tcpPort?: number;
}

export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  monitorInterval?: number;
  isActive?: boolean;
  status?: CheckStatus;
  tags?: string[];
  // Type-specific config
  httpMethod?: string;
  httpHeaders?: Record<string, string>;
  timeoutMs?: number;
  expectedStatusCode?: number;
  jsonPath?: string;
  jsonPathExpected?: string;
  tcpPort?: number;
}

export class MonitorService {
  static async create(input: CreateMonitorInput) {
    const slug =
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 7);

    const monitor = await db.monitor.create({
      data: {
        userId: input.userId,
        name: input.name,
        url: input.url,
        type: input.type,
        monitorInterval: input.monitorInterval,
        slug,
        // Type-specific config
        httpMethod: input.httpMethod ?? "GET",
        httpHeaders: input.httpHeaders ?? undefined,
        timeoutMs: input.timeoutMs ?? 8000,
        expectedStatusCode: input.expectedStatusCode ?? undefined,
        jsonPath: input.jsonPath ?? undefined,
        jsonPathExpected: input.jsonPathExpected ?? undefined,
        tcpPort: input.tcpPort ?? undefined,
        tags: input.tags
          ? {
              connectOrCreate: input.tags.map((tagName) => ({
                where: { userId_name: { userId: input.userId, name: tagName } },
                create: { userId: input.userId, name: tagName },
              })),
            }
          : undefined,
      },
      include: {
        tags: true,
      },
    });

    await AuditService.log(input.userId, "MONITOR_CREATE", {
      monitorId: monitor.id,
      name: monitor.name,
    });
    return monitor;
  }

  static async list(userId: string, tagFilter?: string) {
    return await db.monitor.findMany({
      where: {
        userId,
        tags: tagFilter ? { some: { name: tagFilter } } : undefined,
      },
      include: {
        tags: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async getById(id: string, userId: string) {
    return await db.monitor.findFirst({
      where: { id, userId },
      include: {
        tags: true,
        sslCertificate: true,
      },
    });
  }

  static async update(id: string, userId: string, input: UpdateMonitorInput) {
    const updateData: Prisma.MonitorUpdateInput = {
      name: input.name,
      url: input.url,
      monitorInterval: input.monitorInterval,
      isActive: input.isActive,
      status: input.status,
      // Type-specific config
      httpMethod: input.httpMethod,
      timeoutMs: input.timeoutMs,
      expectedStatusCode: input.expectedStatusCode,
      jsonPath: input.jsonPath,
      jsonPathExpected: input.jsonPathExpected,
      tcpPort: input.tcpPort,
    };

    if (input.httpHeaders !== undefined) {
      updateData.httpHeaders = input.httpHeaders;
    }

    if (input.tags !== undefined) {
      updateData.tags = {
        set: [],
        connectOrCreate: input.tags.map((tagName) => ({
          where: { userId_name: { userId, name: tagName } },
          create: { userId, name: tagName },
        })),
      };
    }

    const monitor = await db.monitor.update({
      where: { id, userId },
      data: updateData,
      include: {
        tags: true,
      },
    });

    const action =
      input.isActive === false
        ? "MONITOR_PAUSE"
        : input.isActive === true
          ? "MONITOR_RESUME"
          : "MONITOR_UPDATE";
    await AuditService.log(userId, action, { monitorId: monitor.id, changes: input });
    return monitor;
  }

  static async delete(id: string, userId: string) {
    const monitor = await db.monitor.delete({
      where: { id, userId },
    });

    await AuditService.log(userId, "MONITOR_DELETE", {
      monitorId: id,
      name: monitor.name,
    });
    return monitor;
  }
}
