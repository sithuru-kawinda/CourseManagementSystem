#!/usr/bin/env node
/**
 * Newman Runner — Online Firebase variant.
 *
 * What this script does:
 *   1. Restores all 6 seed accounts to original state (via _restore-seeds logic)
 *   2. Signs in all 6 accounts against real Firebase Auth
 *   3. Runs every request in the collection against localhost:3000 (local services)
 *   4. Generates CLI report + HTML report at postman/newman-report.html
 *
 * Prerequisites (all must be running):
 *   - All local services:  bash scripts/start.sh  (+ cell-service + analytics-service)
 *   - Services connected to ONLINE Firebase (FIRESTORE_EMULATOR_HOST must NOT be set)
 *   - .env must have FIREBASE_WEB_API_KEY set
 *
 * Usage:
 *   node scripts/newman-run-online.js
 */
'use strict';

const path        = require('path');
const fs          = require('fs');
const { execSync } = require('child_process');
const newman      = require('newman');

// ── Read .env ─────────────────────────────────────────────────────────────────
const envFile = path.join(__dirname, '../.env');
const envVars = {};
fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
  if (m) envVars[m[1]] = m[2].replace(/\\n/g, '\n');
});

const FIREBASE_WEB_API_KEY = envVars.FIREBASE_WEB_API_KEY;
const AUTH_URL  = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;
const BASE_URL  = 'http://localhost:3000/api/v1';
const AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1';

if (!FIREBASE_WEB_API_KEY) {
  console.error('❌  FIREBASE_WEB_API_KEY is not set in .env');
  process.exit(1);
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const res = await fetch(AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}: ${body.error?.message || JSON.stringify(body)}`);
  }
  return { token: body.idToken, uid: body.localId };
}

function ev(key, value) {
  return { key, value: value || '' };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Newman — TCCR Full API Collection (Online Firebase)    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. Verify gateway is reachable
  try {
    const hc = await fetch('http://localhost:3000/healthz');
    if (!hc.ok) throw new Error(`status ${hc.status}`);
    console.log('✓  Gateway is up (localhost:3000)');
  } catch (e) {
    console.error(`❌  Gateway not reachable: ${e.message}`);
    console.error('    Start services: bash scripts/start.sh');
    process.exit(1);
  }

  // 2. Check V2 services
  const v2checks = await Promise.allSettled([
    fetch('http://localhost:3009/healthz').then(r => r.ok),
    fetch('http://localhost:3011/healthz').then(r => r.ok),
  ]);
  if (!v2checks[0].value) console.warn('⚠️   cell-service (3009) not reachable — Cell Service tests will fail');
  else console.log('✓  cell-service (3009) is up');
  if (!v2checks[1].value) console.warn('⚠️   analytics-service (3011) not reachable — Analytics tests will fail');
  else console.log('✓  analytics-service (3011) is up');

  // 3. Restore seed accounts to original state
  console.log('\n✓  Restoring seed accounts...');
  try {
    execSync('node scripts/_restore-seeds.js', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('⚠️   Seed restore failed (continuing — accounts may already be in correct state)');
  }

  // 4. Sign in all 6 seed accounts
  console.log('\n✓  Signing in seed accounts via Firebase Auth...');
  let sa, adminAcc, student1, student2, leader, g12;
  try {
    [sa, adminAcc, student1, student2, leader, g12] = await Promise.all([
      signIn('superadmin@cmp.com', 'SuperAdmin@123'),
      signIn('admin@cmp.com',      'Admin@12345'),
      signIn('student1@cmp.com',   'Student1@123'),
      signIn('student2@cmp.com',   'Student2@123'),
      signIn('leader@cmp.com',     'Leader@12345'),
      signIn('g12leader@cmp.com',  'G12Lead@123'),
    ]);
    console.log('✓  Tokens ready');
    console.log(`   super_admin : ${sa.uid}`);
    console.log(`   admin       : ${adminAcc.uid}`);
    console.log(`   student1    : ${student1.uid}`);
    console.log(`   student2    : ${student2.uid}`);
    console.log(`   leader      : ${leader.uid}`);
    console.log(`   g12         : ${g12.uid}`);
  } catch (e) {
    console.error(`❌  Auth failed: ${e.message}`);
    console.error('    Ensure seed accounts exist in online Firebase and .env has FIREBASE_WEB_API_KEY');
    process.exit(1);
  }

  // 5. Verify services accept the tokens
  try {
    const probe = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${sa.token}` },
    });
    if (probe.status === 401) {
      console.error('\n❌  Services are rejecting Firebase tokens (401 on /me).');
      console.error('    Are services connected to the same Firebase project as .env?');
      process.exit(1);
    }
    console.log('✓  Firebase tokens accepted by services');
  } catch (e) {
    // non-fatal — Newman will surface details
  }

  console.log('\n▶  Running Newman collection...\n');

  newman.run({
    collection:  path.join(__dirname, '../postman/CMP_Backend.postman_collection.json'),
    environment: path.join(__dirname, '../postman/CMP_Local.postman_environment.json'),
    envVar: [
      ev('baseUrl',           BASE_URL),
      ev('authBaseUrl',       AUTH_BASE),
      ev('firebaseWebApiKey', FIREBASE_WEB_API_KEY),
      // Pre-seed all tokens — Sign In folder will refresh them
      ev('superAdminToken', sa.token),
      ev('superAdminId',    sa.uid),
      ev('adminToken',      adminAcc.token),
      ev('adminId',         adminAcc.uid),
      ev('studentToken',    student2.token),
      ev('student2Token',   student2.token),
      ev('student2Id',      student2.uid),
      ev('userId',          student2.uid),
      ev('student1Token',   student1.token),
      ev('student1Id',      student1.uid),
      ev('leaderToken',     leader.token),
      ev('leaderId',        leader.uid),
      ev('g12Token',        g12.token),
      ev('g12Id',           g12.uid),
    ],
    delayRequest:   400,
    timeoutRequest: 30000,
    color:          'on',
    reporters:      ['cli', 'htmlextra'],
    reporter: {
      htmlextra: {
        export:            path.join(__dirname, '../postman/newman-report.html'),
        title:             'TCCR Backend — Full API Test Report (Online Firebase)',
        browserTitle:      'TCCR API Tests',
        showMarkdownLinks: true,
        omitHeaders:       true,
      },
    },
  }, (err, summary) => {
    if (err) {
      console.error('\n❌  Newman runner error:', err.message);
      process.exit(1);
    }

    const { stats } = summary.run;
    const total    = stats.assertions.total;
    const failed   = stats.assertions.failed;
    const passed   = total - failed;
    const reqFail  = stats.requests.failed;

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    Final Summary                         ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Requests  : ${String(stats.requests.total).padEnd(6)} (${reqFail} network errors)`.padEnd(59) + '║');
    console.log(`║  Assertions: ${String(total).padEnd(6)} passed: ${String(passed).padEnd(6)} failed: ${failed}`.padEnd(59) + '║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    if (failed === 0 && reqFail === 0) {
      console.log('║  ✅  ALL TESTS PASSED                                    ║');
    } else {
      console.log(`║  ❌  ${failed + reqFail} ISSUE(S) FOUND — check HTML report           ║`);
    }
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\n📄  HTML report → postman/newman-report.html\n');

    if (failed > 0 || reqFail > 0) process.exitCode = 1;
  });
}

main().catch(e => {
  console.error('\n❌  Unexpected error:', e.message);
  process.exit(1);
});
