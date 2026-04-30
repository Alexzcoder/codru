import { Resend } from "resend";

// PRD §2.2: transactional email via Resend (or Postmark/Mailgun — partner chooses).
// Dev-mode fallback: if RESEND_API_KEY is empty, log to console and return the link
// so the UI can surface it instead. Lets the user test the invite/reset flow without
// setting up email.

type SendResult = { sent: boolean; fallbackLink?: string };

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const from = process.env.RESEND_FROM ?? "CRM <onboarding@resend.dev>";

export async function sendInviteEmail({
  to,
  inviteUrl,
  inviterName,
}: {
  to: string;
  inviteUrl: string;
  inviterName: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email/dev] Invite for ${to}: ${inviteUrl}`);
    return { sent: false, fallbackLink: inviteUrl };
  }

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject: `${inviterName} invited you to CRM`,
      html: `
        <p>${escape(inviterName)} invited you to join the CRM.</p>
        <p><a href="${inviteUrl}">Accept invite</a></p>
        <p>This link expires in 48 hours.</p>
      `,
    });
    if (result.error) {
      // Resend rejected (often free-tier destination limits). Surface the
      // link so the OWNER can copy it manually.
      console.warn(`[email] Resend rejected invite for ${to}: ${result.error.message ?? result.error}`);
      return { sent: false, fallbackLink: inviteUrl };
    }
  } catch (e) {
    console.warn(`[email] sendInviteEmail threw for ${to}: ${e instanceof Error ? e.message : e}`);
    return { sent: false, fallbackLink: inviteUrl };
  }
  return { sent: true };
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email/dev] Password reset for ${to}: ${resetUrl}`);
    return { sent: false, fallbackLink: resetUrl };
  }

  await resend.emails.send({
    from,
    to,
    subject: "Reset your CRM password",
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">Reset password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `,
  });
  return { sent: true };
}

export async function sendNotificationEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email/dev] Notification for ${to}: ${subject}\n${body}`);
    return { sent: false };
  }
  await resend.emails.send({
    from,
    to,
    subject,
    html: `<p>${escape(body).replace(/\n/g, "<br>")}</p>`,
  });
  return { sent: true };
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
