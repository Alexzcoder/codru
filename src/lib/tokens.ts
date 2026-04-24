import crypto from "node:crypto";

// We store token *hashes* in the DB, never the raw token. The raw token is only
// in the email link. This means a leaked DB does not compromise pending invites/resets.

export function generateToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
