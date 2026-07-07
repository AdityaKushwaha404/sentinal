import { NextResponse } from "next/server";
import { MonitorService } from "@/services/monitor";
import { z } from "zod";
import { logger } from "@/lib/logger";

import { getOrCreateCurrentUser } from "@/services/user";

const createMonitorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  type: z.enum(["HTTP", "PING", "TCP", "SSL"]).default("HTTP"),
  monitorInterval: z.number().int().min(1).default(5),
  tags: z.array(z.string()).optional(),
});

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
      ...payload,
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
