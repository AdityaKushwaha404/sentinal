import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/services/user";
import { getGeminiClient } from "@/lib/gemini";
import { EmailService } from "@/services/emails";
import { logger } from "@/lib/logger";

export async function POST() {
  const user = await getOrCreateCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── 1. Fetch all monitoring data ────────────────────────────
    const [monitors, recentIncidents, recentChecks, sslCerts] = await Promise.all([
      db.monitor.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, url: true, type: true, status: true, isActive: true, monitorInterval: true, lastCheckedAt: true },
      }),
      db.incident.findMany({
        where: { monitor: { userId: user.id }, startedAt: { gte: sevenDaysAgo } },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: { title: true, status: true, startedAt: true, resolvedAt: true, description: true },
      }),
      db.monitorCheck.findMany({
        where: { monitor: { userId: user.id }, checkedAt: { gte: sevenDaysAgo } },
        select: { monitor: { select: { name: true } }, isAvailable: true, responseTime: true, statusCode: true, checkedAt: true },
      }),
      db.sSLCertificate.findMany({
        where: { monitor: { userId: user.id } },
        select: { monitor: { select: { name: true } }, expiryDate: true, status: true, issuer: true },
      }),
    ]);

    // ── 2. Compute metrics ──────────────────────────────────────
    const totalMonitors = monitors.length;
    const healthyCount = monitors.filter((m) => m.status === "HEALTHY").length;
    const downCount = monitors.filter((m) => m.status === "DOWN").length;
    const activeCount = monitors.filter((m) => m.isActive).length;

    const successChecks = recentChecks.filter((c) => c.isAvailable && c.responseTime > 0);
    const avgLatency = successChecks.length > 0
      ? Math.round(successChecks.reduce((s, c) => s + c.responseTime, 0) / successChecks.length)
      : 0;

    const uptimeRatio = recentChecks.length > 0
      ? ((recentChecks.filter((c) => c.isAvailable).length / recentChecks.length) * 100).toFixed(2)
      : "100.00";

    const openIncidents = recentIncidents.filter((i) => i.status === "OPEN");
    const resolvedIncidents = recentIncidents.filter((i) => i.status === "RESOLVED");

    const expiringSsl = sslCerts.filter((s) => s.status === "EXPIRING_SOON" || s.status === "EXPIRED");
    const expiredSsl = sslCerts.filter((s) => s.status === "EXPIRED");

    // ── 3. Build context for Gemini ──────────────────────────────
    const context = `
User Infrastructure Summary:
- Total monitors: ${totalMonitors} (${activeCount} active, ${healthyCount} healthy, ${downCount} down)
- Uptime (last 7 days): ${uptimeRatio}%
- Average latency (last 7 days): ${avgLatency}ms
- Open incidents: ${openIncidents.length}
- Resolved incidents (last 7 days): ${resolvedIncidents.length}
- SSL certificates expiring soon: ${expiringSsl.length} (${expiredSsl.length} already expired)
- Total checks performed (last 7 days): ${recentChecks.length}

Monitors:
${monitors.map((m) => `  - ${m.name} (${m.type}) | ${m.url} | Status: ${m.status} | Active: ${m.isActive}`).join("\n")}

Open Incidents:
${openIncidents.length > 0 ? openIncidents.map((i) => `  - ${i.title} (since ${new Date(i.startedAt).toLocaleDateString()})`).join("\n") : "  None"}

SSL Warnings:
${expiringSsl.length > 0 ? expiringSsl.map((s) => `  - ${s.monitor.name}: ${s.status} (expires ${s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : "unknown"})`).join("\n") : "  None"}
`.trim();

    // ── 4. Generate AI summary via Gemini ───────────────────────
    let aiSummary = "";
    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `You are Sentinel AI, an infrastructure monitoring assistant.

Based on the following real-time monitoring data snapshot, generate a concise, professional infrastructure health summary email body.

Requirements:
- 3–5 short paragraphs maximum
- Start with an overall health status sentence (e.g. "Your infrastructure is currently healthy / experiencing issues")
- Highlight any active incidents or down monitors with urgency
- Note SSL warnings if any
- Include the uptime percentage and avg latency as key metrics
- End with a brief recommendation or next action
- Use plain, professional language — no markdown, no bullet points, just clean paragraphs
- Keep it under 200 words total

Data:
${context}

Write only the email body text, nothing else.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        aiSummary = response.text?.trim() || "";
      } catch (err) {
        logger.error("Gemini summary generation failed:", err);
      }
    }

    if (!aiSummary) {
      // Fallback summary without AI
      aiSummary = `Your Sentinel monitoring system is currently tracking ${totalMonitors} monitor${totalMonitors !== 1 ? "s" : ""}.

Infrastructure Status: ${healthyCount} of ${totalMonitors} monitors are healthy. ${downCount > 0 ? `${downCount} monitor${downCount > 1 ? "s are" : " is"} currently DOWN and requires immediate attention.` : "All active monitors are operating normally."}

Performance (last 7 days): Overall uptime stands at ${uptimeRatio}% with an average response latency of ${avgLatency}ms across ${recentChecks.length} checks performed.

${openIncidents.length > 0 ? `Active Incidents: ${openIncidents.length} incident${openIncidents.length > 1 ? "s are" : " is"} currently open. Please review your dashboard for details.` : "No active incidents at this time."}

${expiringSsl.length > 0 ? `SSL Alert: ${expiringSsl.length} SSL certificate${expiringSsl.length > 1 ? "s are" : " is"} expiring soon. Please renew them to avoid service disruption.` : "All SSL certificates are in good standing."}`;
    }

    // ── 5. Build HTML email ──────────────────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const statusColor = downCount > 0 ? "#ef4444" : openIncidents.length > 0 ? "#f59e0b" : "#10b981";
    const statusLabel = downCount > 0 ? "CRITICAL" : openIncidents.length > 0 ? "WARNING" : "HEALTHY";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>Sentinel Infrastructure Summary</title>
</head>
<body style="background-color:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;">
      
      <!-- Header -->
      <div style="border-bottom:1px solid #27272a;padding-bottom:20px;margin-bottom:28px;">
        <div style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:-0.025em;">🛡️ Sentinel</div>
        <div style="margin-top:12px;">
          <span style="display:inline-block;padding:5px 12px;font-size:11px;font-weight:700;border-radius:9999px;background-color:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40;letter-spacing:0.05em;">${statusLabel}</span>
        </div>
        <h2 style="color:#ffffff;margin:10px 0 4px;font-size:20px;font-weight:700;">Infrastructure Summary</h2>
        <p style="color:#71717a;font-size:13px;margin:0;">Generated ${now.toLocaleString()} · Sentinel v2.1</p>
      </div>

      <!-- Metrics row -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        <tr>
          <td style="text-align:center;padding:16px 8px;background:#09090b;border:1px solid #27272a;border-radius:8px;">
            <div style="font-size:24px;font-weight:800;color:#ffffff;">${totalMonitors}</div>
            <div style="font-size:10px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Monitors</div>
          </td>
          <td style="width:8px;"></td>
          <td style="text-align:center;padding:16px 8px;background:#09090b;border:1px solid #27272a;border-radius:8px;">
            <div style="font-size:24px;font-weight:800;color:#10b981;">${uptimeRatio}%</div>
            <div style="font-size:10px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Uptime (7d)</div>
          </td>
          <td style="width:8px;"></td>
          <td style="text-align:center;padding:16px 8px;background:#09090b;border:1px solid #27272a;border-radius:8px;">
            <div style="font-size:24px;font-weight:800;color:#f59e0b;">${avgLatency}ms</div>
            <div style="font-size:10px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Avg Latency</div>
          </td>
          <td style="width:8px;"></td>
          <td style="text-align:center;padding:16px 8px;background:#09090b;border:1px solid ${openIncidents.length > 0 ? "#ef444440" : "#27272a"};border-radius:8px;">
            <div style="font-size:24px;font-weight:800;color:${openIncidents.length > 0 ? "#ef4444" : "#ffffff"};">${openIncidents.length}</div>
            <div style="font-size:10px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Open Incidents</div>
          </td>
        </tr>
      </table>

      <!-- AI Summary -->
      <div style="background-color:#09090b;border:1px solid #27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
        <h3 style="color:#ffffff;margin:0 0 12px;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;">
          🤖 AI Health Analysis
        </h3>
        <p style="font-size:14px;line-height:22px;color:#d4d4d8;margin:0;white-space:pre-line;">${aiSummary}</p>
      </div>

      ${downCount > 0 ? `
      <!-- Down monitors alert -->
      <div style="background-color:#ef444410;border:1px solid #ef444430;border-radius:8px;padding:16px;margin-bottom:24px;">
        <h3 style="color:#ef4444;margin:0 0 10px;font-size:13px;font-weight:700;">🔴 Monitors Currently DOWN</h3>
        ${monitors.filter((m) => m.status === "DOWN").map((m) => `<p style="font-size:13px;color:#fca5a5;margin:4px 0;">• ${m.name} — <span style="color:#71717a;">${m.url}</span></p>`).join("")}
      </div>` : ""}

      ${expiringSsl.length > 0 ? `
      <!-- SSL warnings -->
      <div style="background-color:#f59e0b10;border:1px solid #f59e0b30;border-radius:8px;padding:16px;margin-bottom:24px;">
        <h3 style="color:#f59e0b;margin:0 0 10px;font-size:13px;font-weight:700;">⚠️ SSL Certificate Warnings</h3>
        ${expiringSsl.map((s) => `<p style="font-size:13px;color:#fde68a;margin:4px 0;">• ${s.monitor.name} — expires ${s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : "unknown"}</p>`).join("")}
      </div>` : ""}

      <!-- CTA -->
      <div style="text-align:center;margin-top:8px;">
        <a href="${appUrl}/dashboard" style="display:inline-block;padding:12px 28px;font-size:13px;font-weight:700;color:#ffffff;background-color:#10b981;border-radius:8px;text-decoration:none;">
          Open Dashboard →
        </a>
      </div>

      <!-- Footer -->
      <div style="margin-top:28px;border-top:1px solid #27272a;padding-top:16px;font-size:11px;color:#52525b;text-align:center;">
        Sent on demand via Sentinel v2.1 · <a href="${appUrl}" style="color:#52525b;">${appUrl}</a>
      </div>

    </div>
  </div>
</body>
</html>`;

    // ── 6. Send via Resend ───────────────────────────────────────
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: `Sentinel Alerts <${process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev"}>`,
      to: user.email,
      subject: `[SUMMARY] Infrastructure Health — ${statusLabel} · ${now.toLocaleDateString()}`,
      html,
    });

    if (error) {
      logger.error("Resend send-summary error:", error);
      return NextResponse.json({ error: "Failed to send email. Check Resend configuration." }, { status: 500 });
    }

    logger.info(`On-demand summary email sent to ${user.email}`);
    return NextResponse.json({ success: true, sentTo: user.email });

  } catch (err) {
    logger.error("Send summary route error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
