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
export async function checkHttp(url: string, timeoutMs: number = 8000): Promise<CheckResult> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "SentinelMonitor/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;
    const isAvailable = response.status >= 200 && response.status < 400;

    return {
      statusCode: response.status,
      responseTime,
      isAvailable,
      errorMessage: isAvailable ? null : `HTTP status: ${response.status}`,
    };
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

// TCP Port check
export function checkTcp(host: string, port: number = 80, timeoutMs: number = 5000): Promise<CheckResult> {
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

// TLS Certificate Retrieval
export function checkSsl(hostname: string, port: number = 443, timeoutMs: number = 5000): Promise<SSLCertInfo | null> {
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
          const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

          let status: "VALID" | "EXPIRING" | "EXPIRED" = "VALID";
          if (remainingDays <= 0) {
            status = "EXPIRED";
          } else if (remainingDays <= 30) {
            status = "EXPIRING";
          }

          const issuerCn = Array.isArray(cert.issuer.CN) ? cert.issuer.CN[0] : cert.issuer.CN;
          const issuerO = Array.isArray(cert.issuer.O) ? cert.issuer.O[0] : cert.issuer.O;

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
