export const INCIDENT_ANALYSIS_PROMPT = `
You are a senior DevOps engineer and Site Reliability Engineer (SRE).
Analyze the following infrastructure incident report and provide a structured JSON response.

Incident Parameters:
- Monitor Name: \${monitorName}
- Monitor Type: \${monitorType}
- Target URL: \${targetUrl}
- Current Status: \${currentStatus}
- Previous Status: \${previousStatus}
- Response Time: \${responseTime} ms
- Response Code: \${responseCode}
- Failure Reason: \${failureReason}
- SSL Status: \${sslStatus}
- Recent Latency Trend: \${recentLatencyTrend}
- Recent Incident History: \${recentIncidentHistory}

Return a valid JSON object matching the following structure:
{
  "summary": "Brief 1-2 sentence executive summary of the incident in professional DevOps language.",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "likelyCauses": [
    "Likely cause 1",
    "Likely cause 2"
  ],
  "confidence": 0.0 to 1.0 (float representing confidence level of analysis),
  "recommendedActions": [
    "Step-by-step remediation action 1",
    "Step-by-step remediation action 2"
  ]
}

Ensure the output is ONLY valid JSON. Do not wrap it in markdown code blocks like \\\`\\\`\\\`json.
Do not hallucinate facts. If the confidence level is low due to sparse parameters, explicitly state that in the likely causes and confidence level.
`;
