import nodemailer from "nodemailer";
import { logger } from "./logger";

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  const host = process.env["SMTP_HOST"];
  const port = process.env["SMTP_PORT"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (host && port && user && pass) {
    logger.info({ host, port }, "Using configured SMTP settings for mailer");
    if (host.toLowerCase().includes("gmail.com")) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
      });
    }
  } else {
    logger.warn("SMTP credentials not provided. Generating Ethereal test SMTP account...");
    try {
      const testAccount = await nodemailer.createTestAccount();
      logger.info({ user: testAccount.user }, "Ethereal test account created");
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      logger.error({ err }, "Failed to create Ereal test account. Falling back to log-only transport.");
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: "windows",
      });
    }
  }

  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  try {
    const client = await getTransporter();
    const from = process.env["SMTP_FROM"] || '"Red Fox Hotel HRMS" <noreply@redfoxhotel.com>';
    const info = await client.sendMail({
      from,
      to,
      subject,
      html,
    });

    logger.info({ messageId: info.messageId, to }, "Email sent successfully");

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`\n=============================================================`);
      console.log(`[MAIL PREVIEW] OTP Email sent to ${to}`);
      console.log(`Preview URL: ${previewUrl}`);
      console.log(`=============================================================\n`);
    }
  } catch (err) {
    logger.error({ err, to }, "Failed to send email");
  }
}
