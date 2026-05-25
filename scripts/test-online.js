'use strict';
/**
 * Online system health test — verifies the deployed backend works with online Firebase.
 * Tests key endpoints across all services at https://cms.api.bethelnet.au/api/v1
 *
 * Usage: node scripts/test-online.js
 */

const https = require('https');
const fs    = require('fs');

const BASE    = 'https://cms.api.bethelnet.au/api/v1';
const env     = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2];
});
const API_KEY = env.FIREBASE_WEB_API_KEY;

const pass = [], fail = [], skip = [];

function record(ok, method, path, status, note = '') {
  const sym = ok ? '  ✅' : '  ❌';
  const line = `${sym}  ${method.padEnd(7)} ${path.padEnd(50)} ${String(status).padEnd(5)} ${note}`;
  console.log(line);
  (ok ? pass : fail).push(`${method} ${path}`);
}

function skipped(method, path, note) {
  console.log(`  ⬜  ${method.padEnd(7)} ${path.padEnd(50)}  —    ${note}`);
  skip.push(`${method} ${path}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function request(method, urlPath, body, token) {
  // Small delay between requests to stay within rate limiter (200 req/min = 1 req/300ms)
  await sleep(350);
  return new Promise((res, rej) => {
    const url  = new URL(`${BASE}${urlPath}`);
    const data = body ? JSON.stringify(body) : null;
    const hdrs = { 'Content-Type': 'application/json' };
    if (token) hdrs['Authorization'] = `Bearer ${token}`;
    if (data)  hdrs['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(
      { hostname: url.hostname, path: url.pathname + url.search, method, headers: hdrs },
      r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res({ status: r.statusCode, data: JSON.parse(s) }); } catch { res({ status: r.statusCode, data: s }); } }); },
    );
    req.on('error', rej);
    if (data) req.write(data);
    req.end();
  });
}

async function signIn(email, password) {
  const url  = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const body = JSON.stringify({ email, password, returnSecureToken: true });
  return new Promise((res, rej) => {
    const data = Buffer.from(body);
    const req  = https.request(
      { hostname: 'identitytoolkit.googleapis.com', path: `/v1/accounts:signInWithPassword?key=${API_KEY}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
      r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { const d = JSON.parse(s); if (!d.idToken) rej(new Error(d.error?.message)); else res({ token: d.idToken, uid: d.localId }); }); },
    );
    req.on('error', rej);
    req.write(data);
    req.end();
  });
}

(async () => {
  const run  = Date.now().toString(36).toUpperCase();
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Online Firebase System Test — cms.api.bethelnet.au        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`  Run ID: ${run}`);
  console.log(`  API   : ${BASE}\n`);

  // ── Sign in seed accounts ────────────────────────────────────────────────────
  console.log('── Signing in ...');
  let SA, ADM, STU;
  try {
    [SA, ADM, STU] = await Promise.all([
      signIn('superadmin@cmp.com', 'SuperAdmin@123'),
      signIn('admin@cmp.com',      'Admin@12345'),
      signIn('student2@cmp.com',   'Student2@123'),
    ]);
    console.log(`  ✅ super_admin: ${SA.uid}`);
    console.log(`  ✅ admin:       ${ADM.uid}`);
    console.log(`  ✅ student2:    ${STU.uid}\n`);
  } catch (e) {
    console.error(`  ❌ Sign-in failed: ${e.message}`);
    console.error('  Run: node scripts/_restore-seeds.js  (restores seed accounts on online Firebase)');
    process.exit(1);
  }

  // ── Gateway health ───────────────────────────────────────────────────────────
  console.log('── Health Probes ───────────────────────────────────────────────');
  for (const [svc, port] of [['gateway',3000],['auth',3001],['user',3002],['course',3003],
                              ['enrollment',3004],['progress',3005],['storage',3006],
                              ['notification',3007],['audit',3008],['cell',3009]]) {
    const r = await request('GET', '/healthz');  // via gateway
    // Check health via direct port (services expose own /healthz)
    break; // only test via gateway in this script
  }
  // /healthz is served at root level, not under /api/v1
  const hzRaw = await new Promise(res => {
    const req = https.request({ hostname: 'cms.api.bethelnet.au', path: '/healthz', method: 'GET' },
      r => { let s=''; r.on('data',c=>s+=c); r.on('end',()=>res({status:r.statusCode})); });
    req.on('error', () => res({status:0})); req.end();
  });
  record(hzRaw.status === 200, 'GET', '/healthz (gateway)', hzRaw.status);

  // ── Auth Service ─────────────────────────────────────────────────────────────
  // Auth routes have a strict 10 req/min rate limit — pause before hitting them
  await sleep(6000);
  console.log('\n── Auth Service ────────────────────────────────────────────────');
  const r1 = await request('POST', '/auth/password-reset', { email: 'admin@cmp.com' });
  record(r1.status === 204, 'POST', '/auth/password-reset', r1.status);
  await sleep(6000); // 10/min = 1 per 6s
  const r2 = await request('POST', '/auth/track-failure', { email: 'test@nonexistent.com' });
  record(r2.status === 200, 'POST', '/auth/track-failure', r2.status);

  // ── User Service — /me ───────────────────────────────────────────────────────
  console.log('\n── User Service (/me) ──────────────────────────────────────────');
  const r3 = await request('GET', '/me', null, ADM.token);
  record(r3.status === 200, 'GET', '/me', r3.status,
    r3.status === 200 ? `name: ${r3.data?.firstName} ${r3.data?.lastName}` : '');

  const r4 = await request('GET', '/me', null, STU.token);
  record(r4.status === 200, 'GET', '/me (student)', r4.status,
    r4.status === 200 ? `roles: ${r4.data?.roles?.join(',')}` : '');

  // ── User Service — /users ────────────────────────────────────────────────────
  console.log('\n── User Service (/users) ───────────────────────────────────────');
  const r5 = await request('GET', '/users?limit=5', null, ADM.token);
  record(r5.status === 200, 'GET', '/users', r5.status,
    r5.status === 200 ? `total: ${r5.data?.total}` : '');

  const r5b = await request('GET', '/users?role=g12&limit=5', null, ADM.token);
  record(r5b.status === 200, 'GET', '/users?role=g12', r5b.status,
    r5b.status === 200 ? `total: ${r5b.data?.total}` : '');

  const r5c = await request('GET', `/users/${ADM.uid}`, null, ADM.token);
  record(r5c.status === 200, 'GET', '/users/:uid', r5c.status);

  // ── Super Admin ──────────────────────────────────────────────────────────────
  console.log('\n── Super Admin ─────────────────────────────────────────────────');
  const r6 = await request('GET', '/super-admin/admins', null, SA.token);
  record(r6.status === 200, 'GET', '/super-admin/admins', r6.status,
    r6.status === 200 ? `total: ${r6.data?.total}` : '');

  // ── Course Service ───────────────────────────────────────────────────────────
  console.log('\n── Course Service ──────────────────────────────────────────────');
  const r7 = await request('GET', '/courses', null, ADM.token);
  record(r7.status === 200, 'GET', '/courses', r7.status,
    r7.status === 200 ? `total: ${r7.data?.total}` : '');

  const r7b = await request('GET', '/courses?title=B', null, ADM.token);
  record(r7b.status === 200, 'GET', '/courses?title=B', r7b.status,
    r7b.status === 200 ? `items: ${r7b.data?.items?.length}` : '');

  // ── Enrollment Service ───────────────────────────────────────────────────────
  console.log('\n── Enrollment Service ──────────────────────────────────────────');
  const r8 = await request('GET', '/me/enrollments', null, STU.token);
  record(r8.status === 200, 'GET', '/me/enrollments', r8.status,
    r8.status === 200 ? `total: ${r8.data?.total}` : '');

  const r8b = await request('GET', '/admin/registrations', null, ADM.token);
  record(r8b.status === 200, 'GET', '/admin/registrations', r8b.status,
    r8b.status === 200 ? `total: ${r8b.data?.total}` : '');

  const r8c = await request('GET', '/admin/enrollments', null, ADM.token);
  record(r8c.status === 200, 'GET', '/admin/enrollments', r8c.status,
    r8c.status === 200 ? `total: ${r8c.data?.total}` : '');

  const r8d = await request('GET', '/role-requests', null, ADM.token);
  record(r8d.status === 200, 'GET', '/role-requests', r8d.status,
    r8d.status === 200 ? `total: ${r8d.data?.total}` : '');

  // ── Progress Service ─────────────────────────────────────────────────────────
  console.log('\n── Progress Service ────────────────────────────────────────────');
  const r9 = await request('GET', '/admin/progress/courses/dummy-id', null, ADM.token);
  record([200, 404].includes(r9.status), 'GET', '/admin/progress/courses/:id', r9.status,
    '404 = no course yet (expected)');

  // ── Notification Service ─────────────────────────────────────────────────────
  console.log('\n── Notification Service ────────────────────────────────────────');
  const r10 = await request('GET', '/me/notifications', null, ADM.token);
  record(r10.status === 200, 'GET', '/me/notifications', r10.status,
    r10.status === 200 ? `total: ${r10.data?.total}` : '');

  // ── Audit Service ────────────────────────────────────────────────────────────
  console.log('\n── Audit Service ───────────────────────────────────────────────');
  const r11 = await request('GET', '/audit-log', null, SA.token);
  record(r11.status === 200, 'GET', '/audit-log', r11.status,
    r11.status === 200 ? `total: ${r11.data?.total}` : '');

  // ── Cell Service ─────────────────────────────────────────────────────────────
  console.log('\n── Cell Service ────────────────────────────────────────────────');
  const r12 = await request('GET', '/cells', null, ADM.token);
  record(r12.status === 200, 'GET', '/cells', r12.status,
    r12.status === 200 ? `total: ${r12.data?.total}` : '');

  const r12b = await request('GET', '/cells/network/reports', null, ADM.token);
  record(r12b.status === 200, 'GET', '/cells/network/reports', r12b.status,
    r12b.status === 200 ? `items: ${r12b.data?.items?.length ?? 0}` : '');

  // ── Analytics Service ────────────────────────────────────────────────────────
  console.log('\n── Analytics Service ───────────────────────────────────────────');
  const r13 = await request('GET', '/analytics/cells/weekly', null, ADM.token);
  record([200, 404].includes(r13.status), 'GET', '/analytics/cells/weekly', r13.status);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const total = pass.length + fail.length + skip.length;
  console.log('\n' + '─'.repeat(68));
  console.log(`\n  ✅ Passed : ${pass.length}   ❌ Failed : ${fail.length}   ⬜ Skipped : ${skip.length}   Total : ${total}`);

  if (fail.length > 0) {
    console.log('\n  Failed endpoints:');
    fail.forEach(f => console.log(`    ✗  ${f}`));
  }

  console.log(`\n  System status: ${fail.length === 0 ? '✅ ALL ONLINE CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  console.log('─'.repeat(68) + '\n');

  process.exit(fail.length > 0 ? 1 : 0);
})();
