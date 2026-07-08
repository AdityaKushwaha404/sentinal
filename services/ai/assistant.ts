import { getGeminiClient } from "@/lib/gemini";
import { ASSISTANT_SYSTEM_PROMPT } from "@/prompts/assistant";
import { logger } from "@/lib/logger";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

const RETRYABLE_STATUS_CODES = [429, 503, 500, 502, 504];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as Record<string, unknown>;
  const status = (err.status as number) || (err.code as number);
  if (status && RETRYABLE_STATUS_CODES.includes(status)) return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("model output must contain") ||
    msg.includes("output text or tool calls")
  );
}

function isEmptyOutputError(error: unknown): boolean {
  const msg = String((error as Record<string, unknown>)?.message || "").toLowerCase();
  return msg.includes("model output must contain") || msg.includes("output text or tool calls");
}

export class AiAssistantService {
  static async ask(
    contextSnapshot: string,
    history: ChatMessage[],
    userQuery: string
  ): Promise<string> {
    const ai = getGeminiClient();
    if (!ai) {
      return "The AI Assistant is currently unavailable. Please check that the API key is configured in your environment settings.";
    }

    const systemInstruction = ASSISTANT_SYSTEM_PROMPT.replace(
      "${contextSnapshot}",
      contextSnapshot
    );

    const contents = history.map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    }));

    contents.push({
      role: "user",
      parts: [{ text: userQuery }],
    });

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retrying assistant query (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
          await sleep(RETRY_DELAY_MS * attempt);
        }

        logger.info(
          `Sending assistant query with ${history.length} messages of context memory`
        );

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: {
            systemInstruction,
          },
        });

        return response.text || "I couldn't generate a response. Please try asking again.";
      } catch (error) {
        lastError = error;
        logger.error(`Assistant query attempt ${attempt + 1} failed:`, error);

        if (isRetryableError(error) && attempt < MAX_RETRIES) {
          continue;
        }
        break;
      }
    }

    // Provide a clean, user-friendly error — never expose raw JSON
    if (isEmptyOutputError(lastError)) {
      return "I wasn't able to generate a response for that query. This sometimes happens with complex or ambiguous prompts. Please try rephrasing your question.";
    }

    if (isRetryableError(lastError)) {
      return "I'm experiencing high demand right now and couldn't process your request. Please try again in a few seconds — this is usually temporary.";
    }

    logger.error("Unrecoverable assistant error:", lastError);
    return "Something went wrong while processing your request. Please try again. If the issue persists, check your API configuration.";
  }
}
