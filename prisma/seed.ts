import { PrismaClient, CheckStatus, IncidentStatus } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { loadEnvConfig } from "@next/env";

// Load environment variables
loadEnvConfig(process.cwd());

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seeding database...");

  // Find or create a default user
  let user = await prisma.user.findFirst();
  
  if (!user) {
    console.log("No users found. Creating mock user...");
    user = await prisma.user.create({
      data: {
        id: "user_mock123456",
        email: "mock@sentinel.local",
      },
    });

    await prisma.userSettings.create({
      data: {
        userId: user.id,
        timezone: "UTC",
        theme: "dark",
        emailNotifications: true,
      },
    });
  }

  const userId = user.id;

  // Clean old monitors for this user
  await prisma.monitor.deleteMany({
    where: { userId },
  });

  // Create Tags
  const tagProduction = "Production";
  const tagStaging = "Staging";
  const tagApi = "API";

  console.log("Creating monitors...");

  // Monitor 1: Primary API
  const monitor1 = await prisma.monitor.create({
    data: {
      userId,
      name: "Core API Endpoint",
      url: "https://api.sentinel.local/health",
      type: "HTTP",
      monitorInterval: 1,
      status: CheckStatus.HEALTHY,
      slug: "core-api-endpoint",
      tags: {
        connectOrCreate: [
          { where: { userId_name: { userId, name: tagProduction } }, create: { userId, name: tagProduction } },
          { where: { userId_name: { userId, name: tagApi } }, create: { userId, name: tagApi } },
        ],
      },
    },
  });

  // Monitor 2: Documentation Site
  const monitor2 = await prisma.monitor.create({
    data: {
      userId,
      name: "Docs site",
      url: "https://docs.sentinel.local",
      type: "HTTP",
      monitorInterval: 5,
      status: CheckStatus.HEALTHY,
      slug: "docs-site",
      tags: {
        connectOrCreate: [
          { where: { userId_name: { userId, name: tagProduction } }, create: { userId, name: tagProduction } },
        ],
      },
    },
  });

  // Monitor 3: Unstable Service (Offline/Degraded mock)
  const monitor3 = await prisma.monitor.create({
    data: {
      userId,
      name: "Legacy Auth API",
      url: "https://auth-legacy.sentinel.local/validate",
      type: "HTTP",
      monitorInterval: 5,
      status: CheckStatus.DOWN,
      slug: "legacy-auth-api",
      tags: {
        connectOrCreate: [
          { where: { userId_name: { userId, name: tagStaging } }, create: { userId, name: tagStaging } },
          { where: { userId_name: { userId, name: tagApi } }, create: { userId, name: tagApi } },
        ],
      },
    },
  });

  console.log("Seeding checks & SSL certificates...");

  // Seed SSL certificates
  await prisma.sSLCertificate.createMany({
    data: [
      {
        monitorId: monitor1.id,
        issuer: "Let's Encrypt Authority X3",
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: "VALID",
      },
      {
        monitorId: monitor2.id,
        issuer: "DigiCert TLS RSA SHA256 2020 CA1",
        expiryDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
        status: "VALID",
      },
      {
        monitorId: monitor3.id,
        issuer: "Let's Encrypt Authority X3",
        expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Expired 5 days ago
        status: "EXPIRED",
      },
    ],
  });

  // Seed checks for last 24 hours (every 1 hour for mock latency variation)
  const checksData = [];
  const now = new Date();

  // Monitor 1: stable around 40-70ms
  for (let i = 24; i >= 0; i--) {
    const checkedAt = new Date(now.getTime() - i * 60 * 60 * 1000);
    const latency = Math.floor(Math.random() * 30) + 40;
    checksData.push({
      monitorId: monitor1.id,
      statusCode: 200,
      responseTime: latency,
      isAvailable: true,
      errorMessage: null,
      checkedAt,
    });
  }

  // Monitor 2: stable around 120-150ms
  for (let i = 24; i >= 0; i--) {
    const checkedAt = new Date(now.getTime() - i * 60 * 60 * 1000);
    const latency = Math.floor(Math.random() * 30) + 120;
    checksData.push({
      monitorId: monitor2.id,
      statusCode: 200,
      responseTime: latency,
      isAvailable: true,
      errorMessage: null,
      checkedAt,
    });
  }

  // Monitor 3: failed checks
  for (let i = 5; i >= 0; i--) {
    const checkedAt = new Date(now.getTime() - i * 60 * 60 * 1000);
    checksData.push({
      monitorId: monitor3.id,
      statusCode: 500,
      responseTime: 0,
      isAvailable: false,
      errorMessage: "Internal Server Error",
      checkedAt,
    });
  }

  await prisma.monitorCheck.createMany({
    data: checksData,
  });

  console.log("Seeding incidents...");
  // Create an open incident for Monitor 3
  await prisma.incident.create({
    data: {
      monitorId: monitor3.id,
      status: IncidentStatus.OPEN,
      title: "Service returned HTTP 500",
      description: "Endpoint health check failing consistently with Internal Server Error response.",
      startedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
    },
  });

  // Create a resolved incident for Monitor 1
  await prisma.incident.create({
    data: {
      monitorId: monitor1.id,
      status: IncidentStatus.RESOLVED,
      title: "Network Connection Timeout",
      description: "Temporary packet loss at upstream hosting provider.",
      startedAt: new Date(now.getTime() - 10 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 9.5 * 60 * 60 * 1000), // lasted 30 mins
    },
  });

  // Seed some Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { userId, action: "MONITOR_CREATE", metadata: { name: "Core API Endpoint" } },
      { userId, action: "MONITOR_CREATE", metadata: { name: "Docs site" } },
      { userId, action: "MONITOR_CREATE", metadata: { name: "Legacy Auth API" } },
    ],
  });

  console.log("🌱 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
