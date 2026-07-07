import tls from "tls";
import net from "net";
import { logger } from "@/lib/logger";

export interface CheckResult {
  statusCode: number | null;
  responseTime: number;
  isAvailable: boolean;
  errorMessage: string | null;
}

export interface SSLCertInfo {
  issuer: string;
  expiryDate: Date;
  remainingDays: number;
  status: "VALID" | "EXPIRING" | "EXPIRED";
}

// Extract hostname from URL
export function getHostname(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname;
  } catch {
    return urlStr;
  }
}

// HTTP/HTTPS Availability check
export async function checkHttp(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    followRedirects?: boolean;
    expectedStatusCode?: number;
  } = {}
): Promise<CheckResult> {
  const {
    method = "GET",
    headers = {},
    timeoutMs = 8000,
    expectedStatusCode,
  } = options;

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method,
      headers: {
        "User-Agent": "SentinelMonitor/2.0",
        ...headers,
      },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    let isAvailable: boolean;
    let errorMessage: string | null = null;

    if (expectedStatusCode !== undefined && expectedStatusCode !== null) {
      isAvailable = response.status === expectedStatusCode;
      errorMessage = isAvailable
        ? null
        : `Expected status ${expectedStatusCode}, got ${response.status}`;
    } else {
      isAvailable = response.status >= 200 && response.status < 400;
      errorMessage = isAvailable ? null : `HTTP status: ${response.status}`;
    }

    return { statusCode: response.status, responseTime, isAvailable, errorMessage };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = error instanceof Error ? error.message : "Network Error";
    return {
      statusCode: null,
      responseTime,
      isAvailable: false,
      errorMessage: isAbort ? "Timeout" : message,
    };
  }
}

// JSON API check — fetch + validate status code + optional JSON path assertion
export async function checkJsonApi(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    expectedStatusCode?: number;
    jsonPath?: string;
    jsonPathExpected?: string;
  } = {}
): Promise<CheckResult> {
  const {
    method = "GET",
    headers = {},
    timeoutMs = 8000,
    expectedStatusCode = 200,
    jsonPath,
    jsonPathExpected,
  } = options;

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method,
      headers: {
        "User-Agent": "SentinelMonitor/2.0",
        "Accept": "application/json",
        ...headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    // Status code check
    const statusMatch = response.status === expectedStatusCode;
    if (!statusMatch) {
      return {
        statusCode: response.status,
        responseTime,
        isAvailable: false,
        errorMessage: `Expected status ${expectedStatusCode}, got ${response.status}`,
      };
    }

    // JSON path assertion
    if (jsonPath) {
      try {
        const body = await response.json();
        const actualValue = getNestedValue(body, jsonPath);
        const actualStr = actualValue !== undefined ? String(actualValue) : undefined;

        if (jsonPathExpected !== undefined && jsonPathExpected !== "") {
          if (actualStr !== jsonPathExpected) {
            return {
              statusCode: response.status,
              responseTime,
              isAvailable: false,
              errorMessage: `JSON path "${jsonPath}": expected "${jsonPathExpected}", got "${actualStr}"`,
            };
          }
        } else if (actualValue === undefined || actualValue === null) {
          return {
            statusCode: response.status,
            responseTime,
            isAvailable: false,
            errorMessage: `JSON path "${jsonPath}" not found in response`,
          };
        }
      } catch {
        return {
          statusCode: response.status,
          responseTime,
          isAvailable: false,
          errorMessage: "Response is not valid JSON",
        };
      }
    }

    return { statusCode: response.status, responseTime, isAvailable: true, errorMessage: null };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = error instanceof Error ? error.message : "Network Error";
    return {
      statusCode: null,
      responseTime,
      isAvailable: false,
      errorMessage: isAbort ? "Timeout" : message,
    };
  }
}

// Helper: traverse dot-notation path in an object (e.g. "data.status")
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// TCP Port check
export function checkTcp(
  host: string,
  port: number = 80,
  timeoutMs: number = 5000
): Promise<CheckResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    let resolved = false;

    socket.connect(port, host, () => {
      const responseTime = Date.now() - startTime;
      resolved = true;
      socket.destroy();
      resolve({
        statusCode: 200,
        responseTime,
        isAvailable: true,
        errorMessage: null,
      });
    });

    socket.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      resolve({
        statusCode: null,
        responseTime: Date.now() - startTime,
        isAvailable: false,
        errorMessage: err.message || "Connection refused",
      });
    });

    socket.setTimeout(timeoutMs, () => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        statusCode: null,
        responseTime: timeoutMs,
        isAvailable: false,
        errorMessage: "Connection timeout",
      });
    });
  });
}

// Ping check — ICMP not available without root; uses TCP socket as documented fallback
// Attempts to connect to the specified port (default 80) to confirm host reachability
export async function checkPing(
  host: string,
  port: number = 80,
  timeoutMs: number = 5000
): Promise<CheckResult> {
  const result = await checkTcp(host, port, timeoutMs);
  return {
    ...result,
    errorMessage: result.errorMessage
      ? `Host unreachable (TCP fallback on port ${port}): ${result.errorMessage}`
      : null,
  };
}

// TLS Certificate Retrieval
export function checkSsl(
  hostname: string,
  port: number = 443,
  timeoutMs: number = 5000
): Promise<SSLCertInfo | null> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        port,
        hostname,
        {
          servername: hostname,
          rejectUnauthorized: false, // Let us examine expired or self-signed certs too
        },
        () => {
          const cert = socket.getPeerCertificate(true);
          if (!cert || !cert.valid_to) {
            socket.destroy();
            resolve(null);
            return;
          }

          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          const remainingDays = Math.max(
            0,
            Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          );

          let status: "VALID" | "EXPIRING" | "EXPIRED" = "VALID";
          if (remainingDays <= 0) {
            status = "EXPIRED";
          } else if (remainingDays <= 30) {
            status = "EXPIRING";
          }

          const issuerCn = Array.isArray(cert.issuer.CN)
            ? cert.issuer.CN[0]
            : cert.issuer.CN;
          const issuerO = Array.isArray(cert.issuer.O)
            ? cert.issuer.O[0]
            : cert.issuer.O;

          resolve({
            issuer: issuerCn || issuerO || "Unknown Issuer",
            expiryDate,
            remainingDays,
            status,
          });
          socket.destroy();
        }
      );

      socket.on("error", (err) => {
        logger.warn(`SSL retrieval failed for ${hostname}: ${err.message}`);
        resolve(null);
      });

      socket.setTimeout(timeoutMs, () => {
        socket.destroy();
        resolve(null);
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logger.warn(`SSL retrieval exception for ${hostname}: ${errorMsg}`);
      resolve(null);
    }
  });
}
