import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { AuditService } from "@/services/audit";

import { getOrCreateCurrentUser } from "@/services/user";

const settingsSchema = z.object({
  timezone: z.string().min(1),
  emailNotifications: z.boolean(),
  theme: z.enum(["light", "dark"]),
});

export async function GET() {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const payload = settingsSchema.parse(body);

    const updated = await db.userSettings.upsert({
      where: { userId: user.id },
      update: payload,
      create: {
        userId: user.id,
        ...payload,
      },
    });

    await AuditService.log(user.id, "SETTINGS_UPDATE", payload);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.issues, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
