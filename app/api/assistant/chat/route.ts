import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/services/user";
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

    // 2. Build contextual snapshot for database metrics
    const [monitors, recentIncidents, recentChecks, sslCerts] = await Promise.all([
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
        },
      }),
      db.incident.findMany({
        where: { monitor: { userId: user.id } },
        orderBy: { startedAt: "desc" },
        take: 8,
        select: {
          title: true,
          status: true,
          startedAt: true,
          resolvedAt: true,
          description: true,
        },
      }),
      db.monitorCheck.findMany({
        where: { monitor: { userId: user.id } },
        orderBy: { checkedAt: "desc" },
        take: 15,
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
    ]);

    // Sanitize context snapshot for Zod verification prompts (remove absolute database ids and raw urls)
    const contextSnapshot = JSON.stringify({
      monitorsCount: monitors.length,
      monitorsList: monitors.map((m) => ({
        name: m.name,
        type: m.type,
        status: m.status,
        interval: m.monitorInterval,
      })),
      recentIncidents: recentIncidents.map((i) => ({
        incidentTitle: i.title,
        status: i.status,
        startedAt: i.startedAt,
        resolvedAt: i.resolvedAt,
        description: i.description,
      })),
      recentResponseChecks: recentChecks.map((c) => ({
        monitorName: c.monitor.name,
        code: c.statusCode,
        latencyMs: c.responseTime,
        ok: c.isAvailable,
        error: c.errorMessage,
        at: c.checkedAt,
      })),
      sslCertificates: sslCerts.map((s) => ({
        monitorName: s.monitor.name,
        issuer: s.issuer,
        expiresAt: s.expiryDate,
        status: s.status,
      })),
    });

    // 3. Retrieve conversation history
    const history = await db.assistantMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      take: 20, // Keep context window bounded
    });

    const assistantHistory = history.map((h) => ({
      role: h.role as "user" | "model",
      content: h.content,
    }));

    // 4. Query Gemini via AI assistant service
    const replyText = await AiAssistantService.ask(contextSnapshot, assistantHistory, content.trim());

    // Save AI response message to database
    const responseMessage = await db.assistantMessage.create({
      data: {
        sessionId: session.id,
        role: "model",
        content: replyText,
      },
    });

    return NextResponse.json(responseMessage);
  } catch (error) {
    logger.error("Failed to query AI Assistant:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
