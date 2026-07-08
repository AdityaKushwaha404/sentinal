import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/services/user";
import { getGeminiClient } from "@/lib/gemini";
import { AiAssistantService } from "@/services/ai/assistant";
import { logger } from "@/lib/logger";
import { env } from "@/config/env";

export async function POST(req: Request) {
  const user = await getOrCreateCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!env.ENABLE_AI_ASSISTANT) {
    return NextResponse.json(
      { error: "AI Assistant is disabled." },
      { status: 403 }
    );
  }

  try {
    const { sessionId, content } = await req.json();

    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json({ error: "Content is required." }, { status: 400 });
    }

    // 1. Verify/Retrieve Session
    const session = await db.assistantSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 444 });
    }

    // Save user's question to database
    await db.assistantMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: content.trim(),
      },
    });

    // 2. Build rich contextual snapshot with live database data
    const [monitors, recentIncidents, recentChecks, sslCerts, weeklyReports] =
      await Promise.all([
        db.monitor.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            name: true,
            url: true,
            type: true,
            status: true,
            monitorInterval: true,
            lastCheckedAt: true,
            tags: { select: { name: true } },
          },
        }),
        db.incident.findMany({
          where: { monitor: { userId: user.id } },
          orderBy: { startedAt: "desc" },
          take: 10,
          select: {
            title: true,
            status: true,
            startedAt: true,
            resolvedAt: true,
            description: true,
            aiSummary: true,
            aiLikelyCause: true,
            aiRecommendedActions: true,
            aiConfidenceScore: true,
          },
        }),
        db.monitorCheck.findMany({
          where: { monitor: { userId: user.id } },
          orderBy: { checkedAt: "desc" },
          take: 20,
          select: {
            monitor: { select: { name: true } },
            statusCode: true,
            responseTime: true,
            isAvailable: true,
            errorMessage: true,
            checkedAt: true,
          },
        }),
        db.sSLCertificate.findMany({
          where: { monitor: { userId: user.id } },
          select: {
            monitor: { select: { name: true } },
            issuer: true,
            expiryDate: true,
            status: true,
          },
        }),
        db.weeklyReport.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 4, // Last 4 weekly reports for trend analysis
          select: {
            startDate: true,
            endDate: true,
            uptimeRatio: true,
            totalIncidents: true,
            averageLatency: true,
            fastestMonitorName: true,
            slowestMonitorName: true,
            unstableMonitorName: true,
            reliableMonitorName: true,
            downtimeDurationMs: true,
            sslExpiringCount: true,
            aiExecutiveSummary: true,
            aiHealthAnalysis: true,
            aiKeyFindings: true,
            aiRecommendations: true,
            aiPriorityActions: true,
            createdAt: true,
          },
        }),
      ]);

    // Compute derived metrics for richer AI context
    const healthyCount = monitors.filter((m) => m.status === "HEALTHY").length;
    const downCount = monitors.filter((m) => m.status === "DOWN").length;

    const availableChecks = recentChecks.filter((c) => c.isAvailable && c.responseTime);
    const avgLatency =
      availableChecks.length > 0
        ? Math.round(
            availableChecks.reduce((s, c) => s + (c.responseTime ?? 0), 0) /
              availableChecks.length
          )
        : null;

    const openIncidents = recentIncidents.filter((i) => i.status === "OPEN");
    const resolvedIncidents = recentIncidents.filter((i) => i.status === "RESOLVED");

    const expiringSsl = sslCerts.filter((s) => {
      if (!s.expiryDate) return false;
      const daysLeft = Math.floor(
        (new Date(s.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysLeft <= 30 && daysLeft >= 0;
    });

    // Build the context snapshot
    const contextSnapshot = JSON.stringify(
      {
        summary: {
          totalMonitors: monitors.length,
          healthyMonitors: healthyCount,
          downMonitors: downCount,
          openIncidents: openIncidents.length,
          recentAvgLatencyMs: avgLatency,
          sslCertificatesExpiringSoon: expiringSsl.length,
          dataAsOf: new Date().toISOString(),
        },
        monitors: monitors.map((m) => ({
          name: m.name,
          url: m.url,
          type: m.type,
          status: m.status,
          intervalSeconds: m.monitorInterval,
          lastCheckedAt: m.lastCheckedAt,
          tags: m.tags.map((t) => t.name),
        })),
        openIncidents: openIncidents.map((i) => ({
          title: i.title,
          startedAt: i.startedAt,
          description: i.description,
          aiSummary: i.aiSummary,
          aiLikelyCause: i.aiLikelyCause,
          aiRecommendedActions: i.aiRecommendedActions,
          aiConfidenceScore: i.aiConfidenceScore,
        })),
        recentIncidents: recentIncidents.map((i) => ({
          title: i.title,
          status: i.status,
          startedAt: i.startedAt,
          resolvedAt: i.resolvedAt,
          description: i.description,
          aiSummary: i.aiSummary,
          aiLikelyCause: i.aiLikelyCause,
          aiRecommendedActions: i.aiRecommendedActions,
          aiConfidenceScore: i.aiConfidenceScore,
        })),
        recentChecks: recentChecks.map((c) => ({
          monitorName: c.monitor.name,
          httpStatus: c.statusCode,
          latencyMs: c.responseTime,
          available: c.isAvailable,
          error: c.errorMessage ?? null,
          checkedAt: c.checkedAt,
        })),
        sslCertificates: sslCerts.map((s) => ({
          monitorName: s.monitor.name,
          issuer: s.issuer,
          expiresAt: s.expiryDate,
          status: s.status,
          daysUntilExpiry: s.expiryDate
            ? Math.floor(
                (new Date(s.expiryDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        })),
        weeklyReports: weeklyReports.map((r) => ({
          period: `${r.startDate?.toISOString().split("T")[0]} to ${r.endDate?.toISOString().split("T")[0]}`,
          uptimePercent: r.uptimeRatio != null ? `${(r.uptimeRatio * 100).toFixed(2)}%` : null,
          totalIncidents: r.totalIncidents,
          avgLatencyMs: r.averageLatency != null ? Math.round(r.averageLatency) : null,
          fastestMonitor: r.fastestMonitorName,
          slowestMonitor: r.slowestMonitorName,
          mostUnreliableMonitor: r.unstableMonitorName,
          mostReliableMonitor: r.reliableMonitorName,
          totalDowntimeMinutes:
            r.downtimeDurationMs != null
              ? Math.round(Number(r.downtimeDurationMs) / 60000)
              : null,
          sslExpiringSoon: r.sslExpiringCount,
          aiExecutiveSummary: r.aiExecutiveSummary,
          aiHealthAnalysis: r.aiHealthAnalysis,
          aiKeyFindings: r.aiKeyFindings,
          aiRecommendations: r.aiRecommendations,
          aiPriorityActions: r.aiPriorityActions,
        })),
      },
      null,
      2
    );

    // 3. Retrieve conversation history
    const history = await db.assistantMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const assistantHistory = history.map((h) => ({
      role: h.role as "user" | "model",
      content: h.content,
    }));

    // 4. Query Gemini via AI assistant service
    const replyText = await AiAssistantService.ask(
      contextSnapshot,
      assistantHistory,
      content.trim()
    );

    // Save AI response message to database
    const responseMessage = await db.assistantMessage.create({
      data: {
        sessionId: session.id,
        role: "model",
        content: replyText,
      },
    });

    // 5. Dynamic personalized title generation (Only rename if title is default)
    if (session.title === "New Chat" || session.title === "New Conversation") {
      try {
        const ai = getGeminiClient();
        if (ai) {
          const titleGenResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a concise 3-5 word title representing this search query. Return only the title text, no quotes, no markdown, no punctuation at the end. Query: "${content.trim()}"`,
          });
          const cleanTitle =
            titleGenResponse.text?.trim().replace(/[\"'.,!?]/g, "").slice(0, 50) ||
            content.trim().slice(0, 40);
          await db.assistantSession.update({
            where: { id: session.id },
            data: { title: cleanTitle },
          });
        }
      } catch (titleErr) {
        logger.error("Failed to generate dynamic session title:", titleErr);
      }
    }

    return NextResponse.json(responseMessage);
  } catch (error) {
    logger.error("Failed to query AI Assistant:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
