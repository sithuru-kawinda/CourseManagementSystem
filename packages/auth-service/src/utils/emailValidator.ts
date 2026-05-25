/**
 * Email domain reachability validator.
 *
 * Performs two checks before registration is allowed:
 *
 * 1. MX record check — verifies the domain has mail exchange DNS records,
 *    meaning the domain is configured to receive emails.
 *    e.g. "sltravel651@gmail.com" → gmail.com has MX records → PASS
 *         "abc@fakexyz12345.com"  → no MX records found     → FAIL
 *
 * 2. Disposable/throwaway email blocklist — rejects known temporary
 *    email services that create fake inboxes.
 *    e.g. "test@mailinator.com"  → FAIL
 *
 * This runs BEFORE Firebase Auth user creation so fake emails never
 * enter the system at all.
 */

import { promises as dns } from 'dns';
import { logger }          from '@shared/logger';

/**
 * Emulator bypass — skip DNS/disposable checks in local development.
 * Consistent with the federated OAuth emulator bypass pattern.
 * Set FIREBASE_AUTH_EMULATOR_HOST to activate.
 */
const EMULATOR_MODE = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

// ── Disposable email domain blocklist ────────────────────────────────────────
// Common throwaway / temporary email providers
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamailblock.com',
  'grr.la', 'sharklasers.com', 'spam4.me',
  'tempmail.com', 'temp-mail.org', 'tempinbox.com',
  'throwam.com', 'trashmail.com', 'trashmail.me', 'trashmail.net',
  'yopmail.com', 'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf',
  'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr',
  'courriel.fr.nf', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'dispostable.com', 'fakeinbox.com',
  '10minutemail.com', '10minutemail.net', '20minutemail.com',
  'mailnull.com', 'spamgourmet.com', 'spamgourmet.net',
  'spamgourmet.org', 'maildrop.cc', 'mailnesia.com',
  'filzmail.com', 'discard.email', 'spamhereplease.com',
  'spamthisplease.com', 'spamfree24.org',
]);

/**
 * Returns true if the email domain has valid MX records AND is not a
 * known disposable email provider.
 *
 * Always resolves (never rejects) — a DNS timeout is treated as invalid.
 */
export async function isEmailReachable(email: string): Promise<{
  valid:  boolean;
  reason: string;
}> {
  // Emulator bypass — skip DNS checks so smoke/integration tests work with test domains
  if (EMULATOR_MODE) {
    return { valid: true, reason: 'OK' };
  }

  const parts  = email.split('@');
  const domain = parts[1]?.toLowerCase();

  if (!domain) {
    return { valid: false, reason: 'INVALID_EMAIL_FORMAT' };
  }

  // 1. Disposable / throwaway check (fast — no network call)
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'DISPOSABLE_EMAIL' };
  }

  // 2. MX record DNS check — verifies domain can receive emails
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { valid: false, reason: 'EMAIL_DOMAIN_UNREACHABLE' };
    }
    return { valid: true, reason: 'OK' };
  } catch (err) {
    logger.warn({ email, domain, err }, 'MX record lookup failed — treating email as invalid');
    return { valid: false, reason: 'EMAIL_DOMAIN_UNREACHABLE' };
  }
}
