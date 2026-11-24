import nodemailer from "nodemailer";
import type { FastifyBaseLogger } from "fastify";
import { config } from "../config.js";

const transport = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;

export async function sendLoginCode(email: string, code: string, log: FastifyBaseLogger): Promise<void> {
  if (!transport) {
    // Development only (config.ts refuses to start in production without SMTP).
    log.warn({ email, code }, "SMTP_URL not set: login code printed instead of emailed");
    return;
  }
  await transport.sendMail({
    from: config.MAIL_FROM,
    to: email,
    subject: `Votre code de connexion : ${code}`,
    text: `Votre code de connexion Car AI est ${code}. Il expire dans 10 minutes.\n\nSi vous n'avez rien demandé, ignorez cet email.`,
  });
}
