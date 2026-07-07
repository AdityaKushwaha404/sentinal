import { NextResponse } from "next/server";
import { MonitorService } from "@/services/monitor";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getOrCreateCurrentUser } from "@/services/user";

const MONITOR_TYPES = ["HTTP", "HTTPS", "TCP", "SSL", "PING", "JSON_API"] as const;

const createMonitorSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    url: z.string().min(1, "URL or host is required"),
    type: z.enum(MONITOR_TYPES).default("HTTP"),
    monitorInterval: z.number().int().min(1).default(5),
    tags: z.array(z.string()).optional(),
    // Type-specific config
    httpMethod: z.enum(["GET", "POST", "PUT", "HEAD", "OPTIONS"]).optional(),
    httpHeaders: z.record(z.string(), z.string()).optional(),
    timeoutMs: z.number().int().min(1000).max(30000).optional(),
    expectedStatusCode: z.number().int().min(100).max(599).optional(),
    jsonPath: z.string().optional(),
    jsonPathExpected: z.string().optional(),
    tcpPort: z.number().int().min(1).max(65535).optional(),
  })
  .refine(
    (data) => {
      // HTTP/HTTPS/JSON_API must have a valid URL
      if (["HTTP", "HTTPS", "JSON_API"].includes(data.type)) {
        try {
          new URL(data.url);
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    { message: "Must be a valid URL (include http/https)", path: ["url"] }
  )
  .refine(
    (data) => {
      // TCP requires a port
      if (data.type === "TCP" && !data.tcpPort) {
        // Allow port embedded in URL like "hostname:8080"
        const hasPort = data.url.includes(":");
        return hasPort;
      }
      return true;
    },
    { message: "TCP monitors require a port number", path: ["tcpPort"] }
  );

export async function GET(req: Request) {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tagFilter = searchParams.get("tag") || undefined;

  const monitors = await MonitorService.list(user.id, tagFilter);
  return NextResponse.json(monitors);
}

export async function POST(req: Request) {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const payload = createMonitorSchema.parse(body);

    const monitor = await MonitorService.create({
      userId: user.id,
      name: payload.name,
      url: payload.url,
      type: payload.type,
      monitorInterval: payload.monitorInterval,
      tags: payload.tags,
      httpMethod: payload.httpMethod,
      httpHeaders: payload.httpHeaders,
      timeoutMs: payload.timeoutMs,
      expectedStatusCode: payload.expectedStatusCode,
      jsonPath: payload.jsonPath,
      jsonPathExpected: payload.jsonPathExpected,
      tcpPort: payload.tcpPort,
    });

    return NextResponse.json(monitor, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.issues, { status: 400 });
    }
    logger.error("Failed to create monitor:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
