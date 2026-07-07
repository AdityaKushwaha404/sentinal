import { headers } from "next/headers";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const webhookSecret = env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("Missing CLERK_WEBHOOK_SECRET environment variable");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(webhookSecret);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error("Error verifying webhook:", err);
    return new Response("Error occurred -- verification failed", {
      status: 400,
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === "user.created") {
    const email = evt.data.email_addresses?.[0]?.email_address;
    if (!id || !email) {
      return new Response("Missing user attributes", { status: 400 });
    }

    // Create user and settings in a transaction
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: id,
          email: email,
        },
      });

      await tx.userSettings.create({
        data: {
          userId: user.id,
          timezone: "UTC",
          theme: "dark",
          emailNotifications: true,
        },
      });
    });

    logger.info(`Synced newly created Clerk user ${id} to database`);
  }

  if (eventType === "user.deleted") {
    if (!id) {
      return new Response("Missing user attributes", { status: 400 });
    }

    await db.user.delete({
      where: { id: id },
    });

    logger.info(`Removed deleted Clerk user ${id} from database`);
  }

  return new Response("", { status: 200 });
}
