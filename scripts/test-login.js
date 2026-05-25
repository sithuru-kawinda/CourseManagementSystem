'use strict';
/**
 * Full login test for a user — no password needed.
 * 1. Marks email as verified (Admin SDK) if not already
 * 2. Generates a custom Firebase token for the UID
 * 3. Exchanges it for a real ID token via Firebase REST API
 * 4. Calls GET /me on the live backend to confirm end-to-end auth
 *
 * Usage: node scripts/test-login.js <email> [backendUrl]
 * Example: node scripts/test-login.js sapnanethmini128@gmail.com https://cms.api.bethelnet.au/api/v1
 */
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const admin = require('firebase-admin');

const email      = process.argv[2];
const backendUrl = (process.argv[3] || 'https://cms.api.bethelnet.au/api/v1').replace(/\/$/, '');

if (!email) {
  console.error('Usage: node scripts/test-login.js <email> [backendUrl]');
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fetchJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const mod      = url.startsWith('https') ? https : http;
    const parsed   = new URL(url);
    const reqOpts  = {
      hostname: parsed.hostname,
      port:     parsed.port || (url.startsWith('https') ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  { 'Content-Type': 'application/json', ...(options.headers || {}) },
    };
    const req = mod.request(reqOpts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Load credentials ─────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

const webApiKey = env.FIREBASE_WEB_API_KEY;
if (!webApiKey) {
  console.error('❌  FIREBASE_WEB_API_KEY missing in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const auth = admin.auth();

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🧪  Full Login Test');
  console.log('────────────────────────────────────────');
  console.log('  Email      :', email);
  console.log('  Backend    :', backendUrl);
  console.log('────────────────────────────────────────\n');

  // Step 1 — Get the user
  let authUser;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (err) {
    console.error('❌  User not found in Firebase Auth:', err.message);
    process.exit(1);
  }

  const uid = authUser.uid;
  console.log(`✅  Step 1 — User found  (UID: ${uid})`);

  if (authUser.disabled) {
    console.error('❌  Account is still disabled — run restore-user.js first');
    process.exit(1);
  }
  console.log('✅  Step 2 — Account is enabled');

  // Step 3 — Mark email as verified if needed
  if (!authUser.emailVerified) {
    console.log('⚠️  Email not verified — marking as verified via Admin SDK...');
    try {
      await auth.updateUser(uid, { emailVerified: true });
      console.log('✅  Step 3 — Email marked as verified');
    } catch (err) {
      console.error('❌  Step 3 — Could not verify email:', err.message);
      process.exit(1);
    }
  } else {
    console.log('✅  Step 3 — Email already verified');
  }

  // Step 4 — Generate custom token
  let customToken;
  try {
    customToken = await auth.createCustomToken(uid);
    console.log('✅  Step 4 — Custom token generated');
  } catch (err) {
    console.error('❌  Step 4 — Failed to generate custom token:', err.message);
    process.exit(1);
  }

  // Step 5 — Exchange custom token for ID token via Firebase REST API
  let idToken;
  try {
    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey}`;
    const res = await fetchJson(signInUrl, { method: 'POST' }, {
      token: customToken,
      returnSecureToken: true,
    });

    if (res.status !== 200 || !res.body.idToken) {
      console.error('❌  Step 5 — Firebase sign-in failed:', JSON.stringify(res.body));
      process.exit(1);
    }

    idToken = res.body.idToken;
    console.log('✅  Step 5 — Firebase ID token obtained');
  } catch (err) {
    console.error('❌  Step 5 — REST API call failed:', err.message);
    process.exit(1);
  }

  // Step 6 — Call GET /me on the backend
  console.log(`\n  Calling ${backendUrl}/me ...\n`);
  try {
    const res = await fetchJson(`${backendUrl}/me`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    console.log(`  Response status: ${res.status}`);

    if (res.status === 200) {
      const u = res.body;
      console.log('\n✅  Step 6 — Backend accepted the token');
      console.log('────────────────────────────────────────');
      console.log('  Name    :', `${u.firstName || ''} ${u.lastName || ''}`.trim() || '(not set)');
      console.log('  Email   :', u.email || '(not set)');
      console.log('  Role    :', u.role  || '(not set)');
      console.log('  Roles   :', Array.isArray(u.roles) ? u.roles.join(', ') : '(not set)');
      console.log('  Status  :', u.status || '(not set)');
      console.log('────────────────────────────────────────');
      console.log('\n🎉  LOGIN TEST PASSED — user can authenticate successfully.\n');
    } else if (res.status === 403 && res.body?.error?.code === 'EMAIL_NOT_VERIFIED') {
      console.log('❌  Step 6 — Backend rejected: EMAIL_NOT_VERIFIED');
      console.log('    The email verification flag update may not have propagated yet.');
      console.log('    Wait 30 seconds and run this script again.');
    } else {
      console.log('❌  Step 6 — Unexpected backend response:');
      console.log(JSON.stringify(res.body, null, 2));
    }
  } catch (err) {
    console.error('❌  Step 6 — Backend call failed:', err.message);
    console.log('    Is the backend running? Check with: node scripts/smoke-test.js');
  }

  process.exit(0);
})();
