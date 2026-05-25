#!/usr/bin/env node
/**
 * Newman Runner — runs the full Postman collection automatically.
 *
 * What this script does:
 *   1. Clears Firebase Auth + Firestore emulator data (clean slate every run)
 *   2. Re-seeds the 4 base accounts via seed-emulator.js + V2 roles via seed-v2-roles.js
 *   3. Signs in all 6 accounts and passes tokens to Newman as env vars
 *   4. Runs every request in the collection — no manual copy-paste needed
 *   5. Generates a CLI report + HTML report at postman/newman-report.html
 *
 * Prerequisites (all must be running):
 *   - Firebase emulators:  npx firebase emulators:start
 *   - All services:        docker-compose -f docker-compose.yml -f docker-compose.local.yml up
 *
 * Usage:
 *   node scripts/newman-run.js
 */
'use strict';

const path   = require('path');
const { execSync } = require('child_process');
const newman = require('newman');

const AUTH_EMULATOR    = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const API_KEY          = 'fake-key';
const BASE_URL         = 'http://localhost:3000/api/v1';
const FIREBASE_PROJECT = 'e-learning-f4209';   // matches FIREBASE_PROJECT_ID in docker containers

// ── helpers ───────────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const url = `${AUTH_EMULATOR}/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sign-in failed for ${email}: ${body}`);
  }
  const d = await res.json();
  return { token: d.idToken, uid: d.localId };
}

function envVar(key, value) {
  return { key, value: value || '' };
}

async function clearEmulators() {
  // Clear Firestore
  const fsUrl = `http://localhost:8080/emulator/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
  const fsRes = await fetch(fsUrl, { method: 'DELETE' });
  if (!fsRes.ok && fsRes.status !== 404) throw new Error(`Firestore clear failed: ${fsRes.status}`);

  // Clear Firebase Auth emulator — ensures disabled/suspended accounts from previous
  // test runs don't survive into the next Newman session. seed-emulator.js recreates
  // all accounts fresh after this.
  const authUrl = `http://localhost:9099/emulator/v1/projects/${FIREBASE_PROJECT}/accounts`;
  const authRes = await fetch(authUrl, { method: 'DELETE' });
  if (!authRes.ok && authRes.status !== 404) throw new Error(`Auth emulator clear failed: ${authRes.status}`);
}

async function seedAccounts() {
  execSync('node scripts/seed-emulator.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
  });
  execSync('node scripts/seed-v2-roles.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
  });
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     Newman — TCCR Full API Collection Runner             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. Verify gateway is reachable
  try {
    const hc = await fetch('http://localhost:3000/healthz');
    if (!hc.ok) throw new Error(`status ${hc.status}`);
    console.log('✓  Gateway is up');
  } catch (e) {
    console.error(`❌  Gateway not reachable: ${e.message}`);
    console.error('    Start services first: docker-compose -f docker-compose.yml -f docker-compose.local.yml up');
    process.exit(1);
  }

  // 2. Clear emulator data and re-seed (clean slate every run)
  console.log('✓  Clearing emulator data...');
  try {
    await clearEmulators();
    console.log('✓  Emulator data cleared');
  } catch (e) {
    console.error(`❌  Could not clear emulators: ${e.message}`);
    console.error('    Ensure Firebase emulators are running: npx firebase emulators:start');
    process.exit(1);
  }

  console.log('✓  Seeding test accounts...');
  try {
    await seedAccounts();
    console.log('✓  Seed accounts ready');
  } catch (e) {
    console.error(`❌  Seeding failed: ${e.message}`);
    process.exit(1);
  }

  // 3. Sign in all seed accounts
  console.log('✓  Signing in seed accounts...');
  let sa, admin, student1, student2, leader, g12;
  try {
    [sa, admin, student1, student2, leader, g12] = await Promise.all([
      signIn('superadmin@cmp.com', 'SuperAdmin@123'),
      signIn('admin@cmp.com',      'Admin@12345'),
      signIn('student1@cmp.com',   'Student1@123'),
      signIn('student2@cmp.com',   'Student2@123'),
      signIn('leader@cmp.com',     'Leader@12345'),
      signIn('g12leader@cmp.com',  'G12Lead@123'),
    ]);
    console.log(`✓  Tokens ready`);
    console.log(`   super_admin: ${sa.uid}`);
    console.log(`   admin:       ${admin.uid}`);
    console.log(`   student1:    ${student1.uid}`);
    console.log(`   student2:    ${student2.uid}`);
    console.log(`   leader:      ${leader.uid}`);
    console.log(`   g12:         ${g12.uid}`);
  } catch (e) {
    console.error(`❌  Auth failed: ${e.message}`);
    console.error('');
    console.error('    Most common cause: Firebase Auth emulator has stale disabled accounts from a');
    console.error('    previous test run. The REST /accounts DELETE endpoint does not clear all state.');
    console.error('');
    console.error('    Fix: restart the Firebase emulators for a clean slate:');
    console.error('      Ctrl+C  (stop emulators)');
    console.error('      npx firebase emulators:start');
    console.error('      node scripts/newman-run.js');
    process.exit(1);
  }

  // 3b. Verify backend accepts emulator tokens (catches wrong Docker startup command)
  try {
    const probe = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${sa.token}` },
    });
    if (probe.status === 401) {
      console.error('\n❌  Services are rejecting emulator tokens (401 on /me with superAdminToken).');
      console.error('    The services must be started with the local Firebase overlay:');
      console.error('    docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build');
      console.error('    (Without docker-compose.local.yml the services verify tokens against');
      console.error('     real Firebase — emulator tokens are always rejected.)\n');
      process.exit(1);
    }
    console.log('✓  Emulator tokens accepted by services');
  } catch (e) {
    // probe failure is non-fatal — Newman will surface the details
  }

  console.log('\n▶  Running Newman collection...\n');

  // 3. Run Newman — pre-inject all tokens so the Sign In folder requests confirm
  //    the credentials work AND downstream requests have tokens available even
  //    if the Sign In folder is skipped or re-ordered.
  newman.run({
    collection:       path.join(__dirname, '../postman/CMP_Backend.postman_collection.json'),
    environment:      path.join(__dirname, '../postman/CMP_Local.postman_environment.json'),
    envVar: [
      envVar('baseUrl',           BASE_URL),
      envVar('authBaseUrl',       AUTH_EMULATOR),
      envVar('firebaseWebApiKey', API_KEY),
      // Pre-seed tokens — Sign In requests will overwrite these with fresh ones
      envVar('superAdminToken',   sa.token),
      envVar('superAdminId',      sa.uid),
      envVar('adminToken',        admin.token),
      envVar('adminId',           admin.uid),
      // student2 is the approved student — used as {{studentToken}} AND {{student2Token}}
      envVar('studentToken',      student2.token),
      envVar('student2Token',     student2.token),
      envVar('student2Id',        student2.uid),
      // userId is an alias for student2Id (used by older requests)
      envVar('userId',            student2.uid),
      envVar('student1Token',     student1.token),
      envVar('student1Id',        student1.uid),
      envVar('leaderToken',       leader.token),
      envVar('leaderId',          leader.uid),
      envVar('g12Token',          g12.token),
      envVar('g12Id',             g12.uid),
    ],
    delayRequest:     400,
    timeoutRequest:   30000,
    color:            'on',
    reporters:        ['cli', 'htmlextra'],
    reporter: {
      htmlextra: {
        export:           path.join(__dirname, '../postman/newman-report.html'),
        title:            'TCCR Backend — Full API Test Report',
        browserTitle:     'TCCR API Tests',
        showMarkdownLinks: true,
        omitHeaders:      true,
      },
    },
  }, (err, summary) => {
    if (err) {
      console.error('\n❌  Newman runner error:', err.message);
      process.exit(1);
    }

    const { stats } = summary.run;
    const passed  = stats.assertions.total - stats.assertions.failed;
    const failed  = stats.assertions.failed;
    const reqFail = stats.requests.failed;

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    Final Summary                         ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Requests :  ${String(stats.requests.total).padEnd(6)}  (${reqFail} errored)`.padEnd(59) + '║');
    console.log(`║  Assertions: ${String(stats.assertions.total).padEnd(6)}  passed: ${passed}   failed: ${failed}`.padEnd(59) + '║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    if (failed === 0 && reqFail === 0) {
      console.log('║  ✅  ALL TESTS PASSED                                    ║');
    } else {
      console.log(`║  ❌  ${failed + reqFail} ISSUE(S) FOUND — check report above         ║`);
    }
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\n📄  HTML report: postman/newman-report.html\n`);

    if (failed > 0 || reqFail > 0) process.exitCode = 1;
  });
}

main().catch(e => {
  console.error('\n❌ Unexpected error:', e.message);
  process.exit(1);
});
