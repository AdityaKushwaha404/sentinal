import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url");

  if (!urlParam) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  // Sanitize and format the URL
  let targetUrl = urlParam.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const startTime = performance.now();
    
    // Perform a real fetch with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Sentinel-Instant-Probe/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);

    // Basic SSL check if https
    const isHttps = targetUrl.startsWith("https://");

    return NextResponse.json({
      url: targetUrl,
      status: response.status,
      statusText: response.statusText,
      latency,
      ssl: isHttps ? "Valid (HTTPS)" : "N/A (HTTP)",
      ok: response.ok,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Could not resolve hostname";
    return NextResponse.json({
      url: targetUrl,
      status: 0,
      statusText: "Connection Failed",
      latency: 0,
      ssl: "Connection Error",
      ok: false,
      error: errorMessage,
    }, { status: 200 });
  }

}
