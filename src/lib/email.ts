// Email service — thin wrapper around Resend for transactional email.
//
// Templates live in src/emails/*.tsx and are loaded lazily so we don't pull
// react-email / Resend into memory on cold boots that never send mail.
//
// Configuration:
//   RESEND_API_KEY — Resend API key. If unset, sending is a no-op (logged).
//   EMAIL_FROM     — From: header, e.g. "Quaesitor <noreply@example.com>".
//
// Usage:
//   await sendEmail(user.email, "welcome", { name: user.name });

import type { ComponentType } from "react";
import { createElement } from "react";
import { Resend } from "resend";
import { logger } from "./logger";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export type EmailTemplate =
  | "welcome"
  | "verify-email"
  | "password-reset"
  | "research-complete"
  | "billing-receipt"
  | "billing-failed";

// Templates are imported dynamically so each is only loaded when actually
// needed (keeps the cold-start path lean).
const templateMap: Record<EmailTemplate, () => Promise<unknown>> = {
  welcome: () => import("@/emails/welcome"),
  "verify-email": () => import("@/emails/verify-email"),
  "password-reset": () => import("@/emails/password-reset"),
  "research-complete": () => import("@/emails/research-complete"),
  "billing-receipt": () => import("@/emails/billing-receipt"),
  "billing-failed": () => import("@/emails/billing-failed"),
};

/**
 * Pick the React component out of a template module.
 *
 * Each template module exports its component as a named export (and
 * optionally as the default). We prefer the first named export that isn't
 * `default`, falling back to `default`, then to the first value. The
 * component carries a static `.subject(props)` function used to render the
 * email subject line.
 */
function pickComponent(mod: Record<string, unknown>): ComponentType<any> {
  for (const [key, value] of Object.entries(mod)) {
    if (key === "default") continue;
    if (typeof value === "function") {
      return value as ComponentType<any>;
    }
  }
  if (typeof mod.default === "function") {
    return mod.default as ComponentType<any>;
  }
  const first = Object.values(mod)[0];
  if (typeof first === "function") {
    return first as ComponentType<any>;
  }
  throw new Error("Template module has no React component export");
}

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  props: Record<string, unknown>
): Promise<void> {
  if (!resend) {
    logger.warn({ to, template }, "RESEND_API_KEY not set, skipping email");
    return;
  }

  const loader = templateMap[template];
  if (!loader) {
    logger.error({ to, template }, "Unknown email template");
    return;
  }

  let component: ComponentType<any>;
  try {
    const mod = (await loader()) as Record<string, unknown>;
    component = pickComponent(mod);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), to, template },
      "Failed to load email template"
    );
    return;
  }

  const subjectFn = (component as unknown as { subject?: (p: typeof props) => string }).subject;
  const subject =
    typeof subjectFn === "function" ? subjectFn(props) : "Quaesitor notification";

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Quaesitor <noreply@example.com>",
    to,
    subject,
    react: createElement(component, props),
  });

  if (error) {
    logger.error({ err: error, to, template }, "Failed to send email");
  } else {
    logger.info({ to, template, subject }, "Email sent");
  }
}
