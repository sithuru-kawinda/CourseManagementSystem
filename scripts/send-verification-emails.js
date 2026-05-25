'use strict';
/**
 * One-time migration: send email-verification links to all existing Firebase Auth
 * users whose emailVerified=false.
 *
 * Run ONCE after deploying the email-verification feature to production.
 * Safe to re-run — skips already-verified and federated-only users.
 *
 * Prerequisites:
 *   - .env.local must contain FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 *     FIREBASE_PRIVATE_KEY, SMTP_USER, SMTP_PASS
 *   - npm install (nodemailer must be available)
 *
 * Usage:
 *   node scripts/send-verification-emails.js
 *   node scripts/send-verification-emails.js --dry-run   # list affected users, send nothing
 */

const fs         = require('fs');
const path       = require('path');
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('ERROR: .env.local not found. Copy .env.example → .env.local and fill in credentials.');
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

// ── Firebase Admin init ───────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const auth = admin.auth();

// ── Nodemailer transport ──────────────────────────────────────────────────────
const smtpUser = env.SMTP_USER;
const smtpPass = env.SMTP_PASS;
const smtpHost = env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(env.SMTP_PORT || '587', 10);

if (!smtpUser || !smtpPass) {
  console.error('ERROR: SMTP_USER and SMTP_PASS must be set in .env.local to send emails.');
  if (!DRY_RUN) process.exit(1);
}

const transport = nodemailer.createTransport({
  host:   smtpHost,
  port:   smtpPort,
  secure: smtpPort === 465,
  auth:   { user: smtpUser, pass: smtpPass },
});

// ── Email template ────────────────────────────────────────────────────────────
function buildVerificationEmail(firstName, verificationLink) {
  return {
    subject: 'Action Required: Verify your TCCR email address',
    html: `
      <p>Hi <strong>${firstName}</strong>,</p>
      <p>We have added an email verification step to improve the security of
         <strong>The Christian Center Rathmalana (TCCR)</strong> platform.</p>
      <p>Please verify your email address to continue using your account:</p>
      <p style="margin:24px 0;">
        <a href="${verificationLink}"
           style="background:#1a73e8;color:#fff;padding:12px 28px;border-radius:4px;
                  text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
          Verify My Email →
        </a>
      </p>
      <p style="font-size:12px;color:#666;">
        Or copy this link into your browser:<br>${verificationLink}
      </p>
      <p style="font-size:12px;color:#666;">
        This link expires in <strong>24 hours</strong>.
        If it has expired, sign in and request a new verification email via the app.
      </p>
      <p style="color:#555;font-size:13px;">
        If you did not create this account, please contact us at
        <a href="mailto:support@tccr.lk">support@tccr.lk</a>.
      </p>
    `.trim(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n=== TCCR Email Verification Migration${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

  let pageToken;
  let total        = 0;
  let skipped      = 0;
  let sent         = 0;
  let failed       = 0;
  const failedList = [];

  do {
    /** @type {import('firebase-admin').auth.ListUsersResult} */
    const result = await auth.listUsers(1000, pageToken);
    pageToken = result.pageToken;

    for (const user of result.users) {
      total++;

      // Skip already-verified users
      if (user.emailVerified) {
        skipped++;
        continue;
      }

      // Skip users with no email (anonymous / phone-only accounts)
      if (!user.email) {
        skipped++;
        continue;
      }

      // Skip users who only have federated providers with no password
      // (Google/Apple sign-in always sets emailVerified=true at Firebase level,
      //  so this case is theoretically impossible — guard just in case)
      const hasPasswordProvider = (user.providerData || []).some(p => p.providerId === 'password');
      if (!hasPasswordProvider) {
        skipped++;
        continue;
      }

      const firstName = (user.displayName || 'there').split(' ')[0];
      console.log(`  Processing: ${user.email} (uid: ${user.uid})`);

      if (DRY_RUN) {
        console.log(`    [DRY RUN] Would send verification email to ${user.email}`);
        sent++;
        continue;
      }

      try {
        const verificationLink = await auth.generateEmailVerificationLink(user.email);
        const { subject, html } = buildVerificationEmail(firstName, verificationLink);

        await transport.sendMail({
          from:    `"TCCR" <${smtpUser}>`,
          to:      user.email,
          subject,
          html,
        });

        console.log(`    ✓ Sent to ${user.email}`);
        sent++;
      } catch (err) {
        console.error(`    ✗ Failed for ${user.email}: ${err.message}`);
        failed++;
        failedList.push({ email: user.email, uid: user.uid, error: err.message });
      }

      // Small delay to avoid hitting Firebase rate limits (100 reqs/min for link generation)
      await new Promise(resolve => setTimeout(resolve, 700));
    }
  } while (pageToken);

  console.log('\n=== Summary ===');
  console.log(`  Total users scanned : ${total}`);
  console.log(`  Already verified    : ${skipped}`);
  console.log(`  Emails sent${DRY_RUN ? ' (dry)' : '       '} : ${sent}`);
  if (!DRY_RUN) {
    console.log(`  Failed              : ${failed}`);
    if (failedList.length > 0) {
      console.log('\nFailed users:');
      failedList.forEach(f => console.log(`  - ${f.email} (${f.uid}): ${f.error}`));
    }
  }
  console.log('');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
