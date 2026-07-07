import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function getOrCreateCurrentUser() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  // Check database user
  let dbUser = await db.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });

  if (!dbUser) {
    logger.info(`Database record for Clerk user ${userId} not found. Synchronizing inline...`);
    const clerkUser = await currentUser();
    if (!clerkUser) {
      logger.error(`Clerk currentUser() resolution returned null for ID ${userId}`);
      return null;
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      logger.error(`Clerk user ${userId} does not have a primary email address.`);
      return null;
    }

    try {
      dbUser = await db.user.create({
        data: {
          id: userId,
          email,
          settings: {
            create: {
              timezone: "UTC",
              emailNotifications: true,
              theme: "dark",
            },
          },
        },
        include: { settings: true },
      });
      logger.info(`Successfully created database user for ${email} (${userId})`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logger.error(`Inline user creation failed for ${userId}: ${errorMsg}`);
      
      // Fallback: check if it got created concurrently
      dbUser = await db.user.findUnique({
        where: { id: userId },
        include: { settings: true },
      });
    }
  }

  return dbUser;
}
