import { NextResponse } from "next/server";
import { MonitorService } from "@/services/monitor";
import { z } from "zod";
import { logger } from "@/lib/logger";

import { getOrCreateCurrentUser } from "@/services/user";

const updateMonitorSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  monitorInterval: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateCurrentUser();
  const { id } = await params;

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const monitor = await MonitorService.getById(id, user.id);
  if (!monitor) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.json(monitor);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateCurrentUser();
  const { id } = await params;

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const payload = updateMonitorSchema.parse(body);

    const monitor = await MonitorService.update(id, user.id, payload);
    return NextResponse.json(monitor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.issues, { status: 400 });
    }
    logger.error("Failed to update monitor:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateCurrentUser();
  const { id } = await params;

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const monitor = await MonitorService.delete(id, user.id);
    return NextResponse.json(monitor);
  } catch (error) {
    logger.error("Failed to delete monitor:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
