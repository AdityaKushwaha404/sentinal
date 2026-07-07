import { Resend } from "resend";
import { logger } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummykey");

export class EmailService {
  private static getBaseTemplate(title: string, bodyContent: string, isSuccess: boolean = false, isWarning: boolean = false) {
    const primaryColor = isSuccess ? "#10b981" : isWarning ? "#f59e0b" : "#ef4444";
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>${title}</title>
          <style>
            body { background-color: #09090b; color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background-color: #18181b; border: 1px border-color: #27272a; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { border-bottom: 1px solid #27272a; padding-bottom: 20px; margin-bottom: 24px; }
            .logo { font-size: 20px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em; }
            .title { font-size: 24px; font-weight: 700; color: ${primaryColor}; margin-top: 16px; }
            .content { font-size: 16px; line-height: 24px; color: #d4d4d8; }
            .footer { margin-top: 32px; border-top: 1px solid #27272a; padding-top: 20px; font-size: 12px; color: #52525b; text-align: center; }
            .badge { display: inline-block; padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 9999px; background-color: ${primaryColor}20; color: ${primaryColor}; border: 1px solid ${primaryColor}40; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <div class="logo">Sentinel</div>
              </div>
              <div class="content">
                ${bodyContent}
              </div>
              <div class="footer">
                This is an automated operational alert dispatched by your Sentinel Monitoring platform.
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  static async sendAlert(to: string, monitorName: string, url: string, errorMsg: string) {
    if (!process.env.RESEND_API_KEY) {
      logger.warn(`Skipping alert dispatch: RESEND_API_KEY is not defined. Alert: ${monitorName} is DOWN.`);
      return;
    }

    try {
      const title = `Alert: ${monitorName} is Offline`;
      const html = this.getBaseTemplate(
        title,
        `
          <span class="badge">OFFLINE</span>
          <h2 style="color: #ffffff; margin-top: 0;">Infrastructure Incident Triggered</h2>
          <p>We detected that your monitor <strong>${monitorName}</strong> (${url}) is currently failing check parameters.</p>
          <div style="background-color: #09090b; border: 1px solid #27272a; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 14px; color: #f43f5e; margin: 20px 0;">
            Reason: ${errorMsg}
          </div>
          <p>Sentinel will continuously ping the host and notify you immediately upon successful connection recovery.</p>
        `,
        false
      );

      await resend.emails.send({
        from: "Sentinel Alerts <alerts@sentinel.monitors.dev>",
        to,
        subject: `[DOWNTIME] ${monitorName} is OFFLINE`,
        html,
      });

      logger.info(`Alert email sent to ${to} for downtime on ${monitorName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(`Failed to send downtime email to ${to} for ${monitorName}: ${message}`);
    }
  }

  static async sendRecovery(to: string, monitorName: string, url: string, downtimeDurationStr: string) {
    if (!process.env.RESEND_API_KEY) {
      logger.warn(`Skipping recovery dispatch: RESEND_API_KEY is not defined. Alert: ${monitorName} is UP.`);
      return;
    }

    try {
      const title = `Resolved: ${monitorName} is Online`;
      const html = this.getBaseTemplate(
        title,
        `
          <span class="badge" style="background-color: #10b98120; color: #10b981; border-color: #10b98140;">RECOVERED</span>
          <h2 style="color: #ffffff; margin-top: 0;">Infrastructure Incident Resolved</h2>
          <p>Your monitor <strong>${monitorName}</strong> (${url}) has recovered and successfully returned online status.</p>
          <p>The total downtime compiled was <strong>${downtimeDurationStr}</strong>.</p>
          <p>All check systems are reporting healthy connection parameters.</p>
        `,
        true
      );

      await resend.emails.send({
        from: "Sentinel Alerts <alerts@sentinel.monitors.dev>",
        to,
        subject: `[RESOLVED] ${monitorName} is ONLINE`,
        html,
      });

      logger.info(`Recovery email sent to ${to} for ${monitorName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(`Failed to send recovery email to ${to} for ${monitorName}: ${message}`);
    }
  }

  static async sendSSLExpiring(to: string, monitorName: string, url: string, remainingDays: number, expiryDate: Date) {
    if (!process.env.RESEND_API_KEY) {
      logger.warn(`Skipping SSL warning: RESEND_API_KEY is not defined.`);
      return;
    }

    try {
      const title = `Warning: SSL Expiring soon for ${monitorName}`;
      const html = this.getBaseTemplate(
        title,
        `
          <span class="badge" style="background-color: #f59e0b20; color: #f59e0b; border-color: #f59e0b40;">SSL EXPIRING</span>
          <h2 style="color: #ffffff; margin-top: 0;">SSL/TLS Invalidation Notice</h2>
          <p>The SSL certificate for <strong>${monitorName}</strong> (${url}) is expiring in <strong>${remainingDays} days</strong> on ${expiryDate.toLocaleDateString()}.</p>
          <p>Please update or renew the certificate parameters as soon as possible to avoid client connection interruptions.</p>
        `,
        false,
        true
      );

      await resend.emails.send({
        from: "Sentinel Alerts <alerts@sentinel.monitors.dev>",
        to,
        subject: `[SSL EXPIRING] Action Required for ${monitorName}`,
        html,
      });

      logger.info(`SSL warning email sent to ${to} for ${monitorName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(`Failed to send SSL warning email to ${to} for ${monitorName}: ${message}`);
    }
  }
}
