'use strict';
/**
 * Checks Google login backend readiness:
 * 1. GOOGLE_CLIENT_ID is set in .env.local
 * 2. Firebase Admin can init (credentials valid)
 * 3. POST /auth/federated/google endpoint is reachable on the live server
 *
 * Run: node scripts/_check-google-auth.js
 */
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const admin = require('firebase-admin');

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

console.log('\n══════════════════════════════════════════════');
console.log('  Google Login — Backend Health Check');
console.log('══════════════════════════════════════════════\n');

// ── 1. Check env vars ─────────────────────────────────────────────────────────
console.log('[ 1 ] Environment variables');
const checks = [
  ['FIREBASE_PROJECT_ID',   env.FIREBASE_PROJECT_ID],
  ['FIREBASE_CLIENT_EMAIL', env.FIREBASE_CLIENT_EMAIL],
  ['FIREBASE_PRIVATE_KEY',  env.FIREBASE_PRIVATE_KEY ? 'SET (hidden)' : ''],
  ['GOOGLE_CLIENT_ID',      env.GOOGLE_CLIENT_ID],
];
let envOk = true;
for (const [key, val] of checks) {
  if (val) {
    const display = key === 'GOOGLE_CLIENT_ID' ? val.slice(0, 30) + '...' : val;
    console.log(`  ✅  ${key.padEnd(28)} = ${display}`);
  } else {
    console.log(`  ❌  ${key.padEnd(28)} = MISSING`);
    envOk = false;
  }
}

// ── 2. Init Firebase Admin & test token creation ──────────────────────────────
console.log('\n[ 2 ] Firebase Admin SDK');
let firebaseOk = false;
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey:  env.FIREBASE_PRIVATE_KEY,
    }),
  });

  // Try to create a custom token (same call FederatedSignInUseCase uses)
  const testUid = 'health-check-uid';
  admin.auth().createCustomToken(testUid, { role: 'member', roles: ['member'] })
    .then(token => {
      console.log(`  ✅  createCustomToken()   works (token length: ${token.length})`);
      firebaseOk = true;
      checkEndpoint();
    })
    .catch(e => {
      console.log(`  ❌  createCustomToken()   FAILED: ${e.message}`);
      checkEndpoint();
    });
} catch (e) {
  console.log(`  ❌  initializeApp() FAILED: ${e.message}`);
  checkEndpoint();
}

// ── 3. Check live API endpoint ────────────────────────────────────────────────
function checkEndpoint() {
  console.log('\n[ 3 ] Live API endpoint — POST /api/v1/auth/federated/google');

  const apiBase = 'cms.api.bethelnet.au';
  const body    = JSON.stringify({ idToken: 'health-check-invalid-token' });

  const options = {
    hostname: apiBase,
    path:     '/api/v1/auth/federated/google',
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 8000,
  };

  const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 401 || res.statusCode === 400) {
        // Expected — invalid test token is correctly rejected
        console.log(`  ✅  Endpoint reachable     HTTP ${res.statusCode} (invalid token correctly rejected)`);
        printSummary(true);
      } else if (res.statusCode === 200) {
        console.log(`  ⚠️   HTTP 200 with invalid token — unexpected (check token validation)`);
        printSummary(true);
      } else {
        console.log(`  ⚠️   HTTP ${res.statusCode} — response: ${data.slice(0, 120)}`);
        printSummary(true);
      }
    });
  });

  req.on('error', e => {
    console.log(`  ❌  Cannot reach ${apiBase}: ${e.message}`);
    printSummary(false);
  });

  req.on('timeout', () => {
    console.log(`  ❌  Request timed out (8s) — server may be down`);
    req.destroy();
    printSummary(false);
  });

  req.write(body);
  req.end();
}

// ── Summary ───────────────────────────────────────────────────────────────────
function printSummary(endpointOk) {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Summary');
  console.log('══════════════════════════════════════════════');
  console.log(`  Env vars       : ${envOk      ? '✅ OK' : '❌ MISSING'}`);
  console.log(`  Firebase Admin : ${firebaseOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`  Live endpoint  : ${endpointOk ? '✅ REACHABLE' : '❌ DOWN'}`);

  if (!env.GOOGLE_CLIENT_ID) {
    console.log('\n  ⚠️   GOOGLE_CLIENT_ID is missing — real Google tokens will be rejected.');
    console.log('       Add it to .env.local → GOOGLE_CLIENT_ID=<your-oauth-client-id>');
  }

  const allOk = envOk && firebaseOk && endpointOk;
  console.log(`\n  Overall: ${allOk ? '✅ Google login backend is READY' : '❌ Issues found — see above'}\n`);
  process.exit(allOk ? 0 : 1);
}
