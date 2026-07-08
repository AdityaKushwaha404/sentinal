import { getGeminiClient } from "@/lib/gemini";
import { WEEKLY_REPORT_PROMPT } from "@/prompts/weekly-report";
import { logger } from "@/lib/logger";

interface WeeklyReportInput {
  startDate: string;
  endDate: string;
  overallUptime: number;
  totalIncidents: number;
  averageLatency: number;
  fastestMonitorName: string;
  slowestMonitorName: string;
  unstableMonitorName: string;
  reliableMonitorName: string;
  downtimeDuration: string;
  sslExpiringCount: number;
}

interface GeminiWeeklyReportResult {
  executiveSummary: string;
  healthAnalysis: string;
  keyFindings: string;
  riskAnalysis: string;
  recommendations: string;
  priorityActions: string;
}

export class AiWeeklyReportService {
  static async generateReport(data: WeeklyReportInput): Promise<GeminiWeeklyReportResult | null> {
    const ai = getGeminiClient();
    if (!ai) {
      logger.info("Gemini AI is disabled or not configured. Skipping weekly report generation.");
      return null;
    }

    try {
      const prompt = WEEKLY_REPORT_PROMPT
        .replace("${startDate}", data.startDate)
        .replace("${endDate}", data.endDate)
        .replace("${overallUptime}", String(data.overallUptime))
        .replace("${totalIncidents}", String(data.totalIncidents))
        .replace("${averageLatency}", String(data.averageLatency))
        .replace("${fastestMonitorName}", data.fastestMonitorName)
        .replace("${slowestMonitorName}", data.slowestMonitorName)
        .replace("${unstableMonitorName}", data.unstableMonitorName)
        .replace("${reliableMonitorName}", data.reliableMonitorName)
        .replace("${downtimeDuration}", data.downtimeDuration)
        .replace("${sslExpiringCount}", String(data.sslExpiringCount));

      logger.info("Requesting Gemini AI analysis for weekly infrastructure report");
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

      const result = JSON.parse(responseText) as GeminiWeeklyReportResult;
      return result;
    } catch (error) {
      logger.error("Error generating weekly infrastructure report via Gemini:", error);
      return null;
    }
  }
}
