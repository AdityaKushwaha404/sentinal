import { GoogleGenAI } from "@google/genai";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!env.ENABLE_AI || !env.GEMINI_API_KEY) {
    return null;
  }

  if (!aiInstance) {
    try {
      aiInstance = new GoogleGenAI({
        apiKey: env.GEMINI_API_KEY,
      });
    } catch (error) {
      logger.error("Failed to initialize Google Gen AI SDK:", error);
    }
  }

  return aiInstance;
}
