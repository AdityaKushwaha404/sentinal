import { getGeminiClient } from "@/lib/gemini";
import { INCIDENT_ANALYSIS_PROMPT } from "@/prompts/incident";
import { logger } from "@/lib/logger";

interface IncidentInput {
  monitorName: string;
  monitorType: string;
  targetUrl: string;
  currentStatus: string;
  previousStatus: string;
  responseTime: number;
  responseCode: string;
  failureReason: string;
  sslStatus: string;
  recentLatencyTrend: string;
  recentIncidentHistory: string;
}

interface GeminiIncidentResult {
  summary: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  likelyCauses: string[];
  confidence: number;
  recommendedActions: string[];
}

export class AiIncidentService {
  static async generateSummary(data: IncidentInput): Promise<GeminiIncidentResult | null> {
    const ai = getGeminiClient();
    if (!ai) {
      logger.info("Gemini AI is disabled or not configured. Skipping AI summary generation.");
      return null;
    }

    try {
      const prompt = INCIDENT_ANALYSIS_PROMPT
        .replace("${monitorName}", data.monitorName)
        .replace("${monitorType}", data.monitorType)
        .replace("${targetUrl}", data.targetUrl)
        .replace("${currentStatus}", data.currentStatus)
        .replace("${previousStatus}", data.previousStatus)
        .replace("${responseTime}", String(data.responseTime))
        .replace("${responseCode}", data.responseCode)
        .replace("${failureReason}", data.failureReason)
        .replace("${sslStatus}", data.sslStatus)
        .replace("${recentLatencyTrend}", data.recentLatencyTrend)
        .replace("${recentIncidentHistory}", data.recentIncidentHistory);

      logger.info(`Requesting Gemini AI analysis for incident on monitor: ${data.monitorName}`);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text?.trim();
      if (!responseText) {
        throw new Error("Empty response received from Gemini API");
      }

      const result = JSON.parse(responseText) as GeminiIncidentResult;
      return result;
    } catch (error) {
      logger.error("Error generating incident summary via Gemini:", error);
      return null;
    }
  }
}
