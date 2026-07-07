import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getOrCreateCurrentUser } from "@/services/user";
import {
  checkHttp,
  checkTcp,
  checkSsl,
  checkJsonApi,
  checkPing,
  getHostname,
} from "@/utils/ping";

// Simple in-memory rate limiter: max 10 requests per user per 60s window
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

const quickCheckSchema = z.object({
  url: z.string().min(1, "URL or host is required"),
  type: z.enum(["HTTP", "HTTPS", "TCP", "SSL", "PING", "JSON_API"]).default("HTTP"),
  httpMethod: z.enum(["GET", "POST", "PUT", "HEAD", "OPTIONS"]).optional(),
  httpHeaders: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(15000).optional(),
  expectedStatusCode: z.number().int().optional(),
  jsonPath: z.string().optional(),
  jsonPathExpected: z.string().optional(),
  tcpPort: z.number().int().min(1).max(65535).optional(),
});

export async function POST(req: Request) {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 10 quick checks per minute." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const payload = quickCheckSchema.parse(body);

    let url = payload.url.trim();
    if (["HTTP", "HTTPS", "JSON_API"].includes(payload.type) && !/^https?:\/\//i.test(url)) {
      url = payload.type === "HTTPS" ? `https://${url}` : `http://${url}`;
    }

    const {
      type,
      httpMethod,
      httpHeaders,
      timeoutMs,
      expectedStatusCode,
      jsonPath,
      jsonPathExpected,
      tcpPort,
    } = payload;

    const startedAt = new Date().toISOString();
    let result;
    let sslInfo = null;

    if (type === "TCP") {
      const hostname = getHostname(url);
      const port = tcpPort ?? parseInt(url.split(":").pop() ?? "80", 10);
      result = await checkTcp(hostname, isNaN(port) ? 80 : port, timeoutMs ?? 5000);
    } else if (type === "PING") {
      const hostname = getHostname(url);
      result = await checkPing(hostname, tcpPort ?? 80, timeoutMs ?? 5000);
    } else if (type === "JSON_API") {
      result = await checkJsonApi(url, {
        method: httpMethod ?? "GET",
        headers: httpHeaders ?? {},
        timeoutMs: timeoutMs ?? 8000,
        expectedStatusCode: expectedStatusCode ?? 200,
        jsonPath: jsonPath,
        jsonPathExpected: jsonPathExpected,
      });
    } else if (type === "SSL") {
      const hostname = getHostname(url);
      sslInfo = await checkSsl(hostname, 443, timeoutMs ?? 5000);
      result = sslInfo
        ? {
            statusCode: 200,
            responseTime: 0,
            isAvailable: sslInfo.status !== "EXPIRED",
            errorMessage:
              sslInfo.status === "EXPIRED" ? "SSL certificate has expired" : null,
          }
        : {
            statusCode: null,
            responseTime: 0,
            isAvailable: false,
            errorMessage: "Could not retrieve SSL certificate",
          };
    } else {
      // HTTP / HTTPS
      result = await checkHttp(url, {
        method: httpMethod ?? "GET",
        headers: httpHeaders ?? {},
        timeoutMs: timeoutMs ?? 8000,
        expectedStatusCode: expectedStatusCode,
      });

      const isHttps = url.startsWith("https://");
      if (isHttps) {
        const hostname = getHostname(url);
        sslInfo = await checkSsl(hostname);
      }
    }

    return NextResponse.json({
      url,
      type,
      startedAt,
      ...result,
      ssl: sslInfo
        ? `${sslInfo.status} — ${sslInfo.remainingDays} days remaining (Issuer: ${sslInfo.issuer || "Unknown"})`
        : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.issues, { status: 400 });
    }
    logger.error("Quick check failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Keep legacy GET endpoint for backwards compat (used by existing quick-check page)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url");

  if (!urlParam) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  let targetUrl = urlParam.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const result = await checkHttp(targetUrl);
    const isHttps = targetUrl.startsWith("https://");
    let sslInfo = null;
    if (isHttps) {
      const hostname = getHostname(targetUrl);
      sslInfo = await checkSsl(hostname);
    }

    return NextResponse.json({
      url: targetUrl,
      status: result.statusCode,
      statusText: result.isAvailable ? "OK" : "Error",
      latency: result.responseTime,
      ssl: sslInfo
        ? `${sslInfo.status} — ${sslInfo.remainingDays} days remaining`
        : isHttps
          ? "Valid (HTTPS)"
          : "N/A (HTTP)",
      ok: result.isAvailable,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Could not resolve hostname";
    return NextResponse.json(
      {
        url: targetUrl,
        status: 0,
        statusText: "Connection Failed",
        latency: 0,
        ssl: "Connection Error",
        ok: false,
        error: errorMessage,
      },
      { status: 200 }
    );
  }
}
