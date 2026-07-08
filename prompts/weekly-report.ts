export const WEEKLY_REPORT_PROMPT = `
You are an IT Infrastructure Director.
Generate a weekly infrastructure health report from the following metrics:

Weekly Metrics:
- Start Date: \${startDate}
- End Date: \${endDate}
- Overall Uptime: \${overallUptime}%
- Total Incidents: \${totalIncidents}
- Average Latency: \${averageLatency} ms
- Fastest Monitor: \${fastestMonitorName}
- Slowest Monitor: \${slowestMonitorName}
- Most Unstable Monitor: \${unstableMonitorName}
- Most Reliable Monitor: \${reliableMonitorName}
- Total Downtime Duration: \${downtimeDuration}
- SSL Certificates Expiring Soon: \${sslExpiringCount}

Return a valid JSON object matching the following structure:
{
  "executiveSummary": "A high-level overview of the past week's infrastructure availability, highlights, and outstanding issues.",
  "healthAnalysis": "Detailed technical analysis of the latency profile, service uptime benchmarks, and reliability trends.",
  "keyFindings": "Top observations, such as unstable components or network trends noticed during the checking interval.",
  "riskAnalysis": "Security and availability risks identified, including expired/expiring SSL certificates or systemic vulnerabilities.",
  "recommendations": "Long-term architecture suggestions (e.g. caching, server upgrades, load-balancing adjustments).",
  "priorityActions": "Immediate actionable steps to resolve outstanding alerts, stabilize unstable servers, or renew certificates."
}

Ensure the output is ONLY valid JSON. Do not wrap it in markdown code blocks like \\\`\\\`\\\`json.
Provide professional, actionable, and executive-ready language.
`;
