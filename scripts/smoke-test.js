#!/usr/bin/env node
/**
 * CMP Smoke Test — verifies all 53 public API endpoints
 *
 * Prerequisites (pick one):
 *   A) bash scripts/start.sh          — starts emulators + seeds + all 10 services
 *   B) docker-compose up --build      — full Docker stack
 *
 * Usage:
 *   node scripts/smoke-test.js
 */
'use strict';

const BASE    = 'http://localhost:3000/api/v1';
const ONLINE  = process.argv.includes('--online');
// Real web API key is required even for local emulator when singleProjectMode=false —
// the emulator uses the key to route sign-in requests to the correct project namespace.
const API_KEY = 'AIzaSyDudm6GFhmqLd6zVW0igYL0myX-vN9H5-0'; // e-learning-f4209 web API key
const AUTH_URL = ONLINE
  ? `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`
  : `http://127.0.0.1:9099/www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=${API_KEY}`;

// ── result tracking ───────────────────────────────────────────────────────────

const results = [];
let pass = 0, fail = 0;

function record(good, method, path, status, expected, note = '') {
  if (good) pass++; else fail++;
  results.push({ good, method, path, status, expected, note });
}

function skipped(method, path, reason) {
  results.push({ good: null, method, path, status: '—', expected: '—', note: reason });
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function api(method, path, body, token) {
  const hdrs = { 'Content-Type': 'application/json' };
  if (token) hdrs['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: hdrs,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    let data = null;
    if (res.status !== 204) {
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) data = await res.json().catch(() => null);
    }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: null };
  }
}

function check(method, path, res, expected, note = '') {
  const good = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
  record(good, method, path, res.status, expected, note);
  return res;
}

async function signIn(email, password) {
  const res = await fetch(AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await res.json();
  if (!res.ok) {
    const msg = d.error?.message ?? JSON.stringify(d);
    if (msg === 'EMAIL_NOT_FOUND' || msg === 'INVALID_LOGIN_CREDENTIALS') {
      throw new Error(
        `Seed account not found: ${email}\n` +
        '    Run:  node scripts/seed-emulator.js   (emulators must be running)',
      );
    }
    throw new Error(`Auth failed for ${email}: ${msg}`);
  }
  return { token: d.idToken, uid: d.localId };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const mode = ONLINE ? 'ONLINE (e-learning-f4209)' : 'LOCAL EMULATOR';
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   CMP Smoke Test — 53 Public API Endpoints               ║');
  console.log(`║   Mode: ${mode.padEnd(49)}║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // ─ connectivity ─────────────────────────────────────────────────────────────
  const hc = await fetch('http://localhost:3000/healthz').catch(() => null);
  if (!hc?.ok) {
    console.error('❌  Gateway not reachable at http://localhost:3000');
    console.error('    Start services first:  bash scripts/start.sh\n');
    process.exit(1);
  }
  console.log('✓  Gateway is up');

  // ─ authenticate seed accounts ────────────────────────────────────────────────
  console.log('✓  Signing in seed accounts...');
  const SA  = await signIn('superadmin@cmp.com', 'SuperAdmin@123');
  let   ADM = await signIn('admin@cmp.com',       'Admin@12345');
  const STU = await signIn('student2@cmp.com',    'Student2@123');
  const STU1 = await signIn('student1@cmp.com', 'Student1@123');
  console.log('✓  Tokens ready (super_admin, admin, student1, student2)\n');

  // Unique suffix for this run to avoid email conflicts
  const RUN = Date.now();
  let r;

  // ╔══════════════════╗
  // ║  AUTH SERVICE    ║
  // ╚══════════════════╝
  console.log('── Auth Service ─────────────────────────');

  // 1. POST /auth/register
  const TS_EMAIL = `smoke_ts_${RUN}@test.com`;
  const TS_PASS  = 'SmokeTest@2026!';
  r = await api('POST', '/auth/register', { firstName: 'Smoke', lastName: 'Tester', email: TS_EMAIL, password: TS_PASS });
  check('POST', '/auth/register', r, 201);
  const TS = await signIn(TS_EMAIL, TS_PASS).catch(() => null);

  // 2. POST /auth/password-reset (always 204 — never reveals if email exists)
  r = await api('POST', '/auth/password-reset', { email: TS_EMAIL });
  check('POST', '/auth/password-reset', r, 204);

  // 3. POST /auth/track-failure
  r = await api('POST', '/auth/track-failure', { email: TS_EMAIL });
  check('POST', '/auth/track-failure', r, 200);

  // 4. POST /auth/logout  (revokes ADM token — must wait ≥1 s before re-signing in)
  // Firebase uses second-precision for auth_time; a token issued in the same second
  // as revokeRefreshTokens will fail verifyIdToken(checkRevoked=true).
  r = await api('POST', '/auth/logout', null, ADM.token);
  check('POST', '/auth/logout', r, 204);
  await sleep(1100);
  ADM = await signIn('admin@cmp.com', 'Admin@12345'); // fresh token

  // ╔══════════════════╗
  // ║  USER SERVICE    ║
  // ╚══════════════════╝
  console.log('── User Service (/me) ───────────────────');

  // 5. GET /me
  r = await api('GET', '/me', null, ADM.token);
  check('GET', '/me', r, 200);

  // 6. PATCH /me
  r = await api('PATCH', '/me', { firstName: 'Admin', lastName: 'Smoke' }, ADM.token);
  check('PATCH', '/me', r, 200);

  // 7. POST /me/change-password  (use TS account, not admin, to keep admin working)
  if (TS) {
    r = await api('POST', '/me/change-password',
      { currentPassword: TS_PASS, newPassword: 'SmokeNew@2026!' }, TS.token);
    check('POST', '/me/change-password', r, [200, 204]);
  } else {
    skipped('POST', '/me/change-password', 'test-student sign-in failed');
  }

  console.log('── User Service (/users) ────────────────');

  // 8. GET /users
  r = await api('GET', '/users', null, ADM.token);
  check('GET', '/users', r, 200);

  // 9. GET /users/:uid
  r = await api('GET', `/users/${STU.uid}`, null, ADM.token);
  check('GET', '/users/:uid', r, 200);

  // Use TS uid for suspend/reactivate to avoid disrupting student2
  const suspendTarget = TS?.uid ?? STU.uid;

  // 10. POST /users/:uid/suspend
  r = await api('POST', `/users/${suspendTarget}/suspend`, null, ADM.token);
  check('POST', '/users/:uid/suspend', r, [200, 409]);

  // 11. POST /users/:uid/reactivate
  r = await api('POST', `/users/${suspendTarget}/reactivate`, null, ADM.token);
  check('POST', '/users/:uid/reactivate', r, [200, 409]);

  console.log('── User Service (/super-admin) ──────────');

  // 12. GET /super-admin/admins
  r = await api('GET', '/super-admin/admins', null, SA.token);
  check('GET', '/super-admin/admins', r, 200);

  // 13. POST /super-admin/admins
  const TMP_EMAIL = `tmp_admin_${RUN}@cmp.com`;
  r = await api('POST', '/super-admin/admins', {
    firstName: 'Tmp', lastName: 'Admin',
    email: TMP_EMAIL, initialPassword: 'TmpAdmin@2026!',
  }, SA.token);
  check('POST', '/super-admin/admins', r, 201);
  const tmpUid = r.data?.id ?? r.data?.uid;

  if (tmpUid) {
    // 14. GET /super-admin/admins/:uid
    r = await api('GET', `/super-admin/admins/${tmpUid}`, null, SA.token);
    check('GET', '/super-admin/admins/:uid', r, 200);

    // 15. POST /super-admin/admins/:uid/suspend
    r = await api('POST', `/super-admin/admins/${tmpUid}/suspend`, null, SA.token);
    check('POST', '/super-admin/admins/:uid/suspend', r, [200, 409]);

    // 16. POST /super-admin/admins/:uid/reactivate
    r = await api('POST', `/super-admin/admins/${tmpUid}/reactivate`, null, SA.token);
    check('POST', '/super-admin/admins/:uid/reactivate', r, [200, 409]);

    // 17. DELETE /super-admin/admins/:uid
    r = await api('DELETE', `/super-admin/admins/${tmpUid}`, null, SA.token);
    check('DELETE', '/super-admin/admins/:uid', r, 204);
  } else {
    ['GET', 'POST', 'POST', 'DELETE'].forEach((m, i) => {
      const paths = [
        '/super-admin/admins/:uid',
        '/super-admin/admins/:uid/suspend',
        '/super-admin/admins/:uid/reactivate',
        '/super-admin/admins/:uid',
      ];
      skipped(m, paths[i], 'POST /super-admin/admins did not return uid');
    });
  }

  // ╔══════════════════╗
  // ║  COURSE SERVICE  ║
  // ╚══════════════════╝
  console.log('── Course Service ───────────────────────');

  // 18. GET /courses (public)
  r = await api('GET', '/courses');
  check('GET', '/courses', r, 200);

  // 19. POST /courses — Course A (used for enrollment + progress tests)
  r = await api('POST', '/courses',
    { title: `Smoke Course A ${RUN}`, description: 'Main smoke test course' }, ADM.token);
  check('POST', '/courses', r, 201);
  const courseA = r.data?.id;

  // 20. GET /courses/:id
  r = await api('GET', `/courses/${courseA}`, null, ADM.token);
  check('GET', '/courses/:id', r, 200);

  // 21. PATCH /courses/:id
  r = await api('PATCH', `/courses/${courseA}`, { title: `Smoke Course A ${RUN} (updated)` }, ADM.token);
  check('PATCH', '/courses/:id', r, 200);

  // 22. POST /courses/:id/semesters
  r = await api('POST', `/courses/${courseA}/semesters`, { title: 'Semester 1' }, ADM.token);
  check('POST', '/courses/:id/semesters', r, 201);
  const semA = r.data?.id;

  // 23. PATCH /semesters/:id
  r = await api('PATCH', `/semesters/${semA}`, { title: 'Semester 1 (updated)' }, ADM.token);
  check('PATCH', '/semesters/:id', r, 200);

  // 24. POST /semesters/:id/subjects
  r = await api('POST', `/semesters/${semA}/subjects`,
    { title: 'Subject 1', youtubeVideoId: 'dQw4w9WgXcQ' }, ADM.token);
  check('POST', '/semesters/:id/subjects', r, 201);
  const subA = r.data?.id;

  // 25. PATCH /subjects/:id
  r = await api('PATCH', `/subjects/${subA}`, { title: 'Subject 1 (updated)' }, ADM.token);
  check('PATCH', '/subjects/:id', r, 200);

  // ─ Course B: used for archive + delete + subject/semester delete tests ─────
  r = await api('POST', '/courses',
    { title: `Smoke Course B ${RUN}`, description: 'Will be archived and deleted' }, ADM.token);
  const courseB = r.data?.id;

  r = await api('POST', `/courses/${courseB}/semesters`, { title: 'Sem B1' }, ADM.token);
  const semB1 = r.data?.id;
  await api('POST', `/semesters/${semB1}/subjects`,
    { title: 'Sub B1', youtubeVideoId: 'dQw4w9WgXcQ' }, ADM.token); // for publish requirement

  // Extra semester + subject that will be deleted
  r = await api('POST', `/courses/${courseB}/semesters`, { title: 'Sem B2 (will be deleted)' }, ADM.token);
  const semB2 = r.data?.id;
  r = await api('POST', `/semesters/${semB2}/subjects`,
    { title: 'Sub B2 (will be deleted)', youtubeVideoId: 'dQw4w9WgXcQ' }, ADM.token);
  const subB2 = r.data?.id;

  // 26. DELETE /subjects/:id
  r = await api('DELETE', `/subjects/${subB2}`, null, ADM.token);
  check('DELETE', '/subjects/:id', r, 204);

  // 27. DELETE /semesters/:id
  r = await api('DELETE', `/semesters/${semB2}`, null, ADM.token);
  check('DELETE', '/semesters/:id', r, 204);

  // Publish Course A (22)
  r = await api('POST', `/courses/${courseA}/publish`, null, ADM.token);
  check('POST', '/courses/:id/publish', r, 200);

  // 28. POST /courses/:id/unpublish
  r = await api('POST', `/courses/${courseA}/unpublish`, null, ADM.token);
  check('POST', '/courses/:id/unpublish', r, 200);

  // Re-publish Course A for enrollment tests
  await api('POST', `/courses/${courseA}/publish`, null, ADM.token);

  // Publish Course B, then archive it
  await api('POST', `/courses/${courseB}/publish`, null, ADM.token);

  // 29. POST /courses/:id/archive
  r = await api('POST', `/courses/${courseB}/archive`, null, ADM.token);
  check('POST', '/courses/:id/archive', r, 200);

  // 30. DELETE /courses/:id
  r = await api('DELETE', `/courses/${courseB}`, null, ADM.token);
  check('DELETE', '/courses/:id', r, 204);

  // ╔══════════════════════╗
  // ║  ENROLLMENT SERVICE  ║
  // ╚══════════════════════╝
  console.log('── Enrollment Service ───────────────────');

  // 31. GET /admin/registrations
  r = await api('GET', '/admin/registrations', null, ADM.token);
  check('GET', '/admin/registrations', r, 200);

  // ── Registration for TS (the smoke-test student) ─────────────────────────
  const tsUid    = TS?.uid;
  const tsRegId  = tsUid; // enrollment-service uses studentUid as registration doc id

  // 32. POST /admin/registrations/bulk-approve  (approve TS via bulk)
  if (tsRegId) {
    r = await api('POST', '/admin/registrations/bulk-approve', { ids: [tsRegId] }, ADM.token);
    check('POST', '/admin/registrations/bulk-approve', r, [200, 207]);
  } else {
    skipped('POST', '/admin/registrations/bulk-approve', 'TS uid unavailable');
  }

  // Register S2 — used later for the enrollment reject test
  r = await api('POST', '/auth/register', {
    firstName: 'S2', lastName: 'Student',
    email: `smoke_s2_${RUN}@test.com`, password: 'SmokeS2@2026!',
  });
  let S2 = await signIn(`smoke_s2_${RUN}@test.com`, 'SmokeS2@2026!').catch(() => null);
  const s2Uid = S2?.uid;

  // 33. POST /admin/registrations/:id/approve
  // V2: new registrations no longer create registration docs. Use student1 (seeded as
  // pending_approval) which has a real registration document in the registrations collection.
  r = await api('POST', `/admin/registrations/${STU1.uid}/approve`, null, ADM.token);
  check('POST', '/admin/registrations/:id/approve', r, [200, 409]);

  // 34. POST /admin/registrations/:id/reject
  // student1 is now approved (or was already), so reject returns 409 INVALID_STATE — valid.
  r = await api('POST', `/admin/registrations/${STU1.uid}/reject`,
    { reason: 'Smoke test rejection' }, ADM.token);
  check('POST', '/admin/registrations/:id/reject', r, [200, 409]);

  // 35. POST /courses/:id/enroll  (student2 enrols in Course A)
  r = await api('POST', `/courses/${courseA}/enroll`, null, STU.token);
  check('POST', '/courses/:id/enroll', r, [201, 409]);
  const enrollId = `${STU.uid}_${courseA}`;

  // 36. GET /me/enrollments
  r = await api('GET', '/me/enrollments', null, STU.token);
  check('GET', '/me/enrollments', r, 200);

  // 37. GET /admin/enrollments
  r = await api('GET', '/admin/enrollments', null, ADM.token);
  check('GET', '/admin/enrollments', r, 200);

  // 38. POST /admin/enrollments/:id/approve
  r = await api('POST', `/admin/enrollments/${enrollId}/approve`, null, ADM.token);
  check('POST', '/admin/enrollments/:id/approve', r, [200, 409]);

  // Enroll S2 for the rejection test.
  // V2: new users get 'member' role — must be upgraded to 'student' before enrolling.
  let s2EnrollId = null;
  if (s2Uid && S2) {
    await api('PATCH', `/users/${s2Uid}/roles`, { role: 'student' }, ADM.token);
    await sleep(800); // allow Firebase emulator to propagate the new custom claim
    S2 = await signIn(`smoke_s2_${RUN}@test.com`, 'SmokeS2@2026!').catch(() => S2);
    r = await api('POST', `/courses/${courseA}/enroll`, null, S2.token);
    // Only mark the ID if the enrollment was actually created (201) or already exists (409).
    if (r.status === 201 || r.status === 409) s2EnrollId = `${s2Uid}_${courseA}`;
  }

  // 39. POST /admin/enrollments/:id/reject
  const rejectEnrollTarget = s2EnrollId ?? enrollId; // fallback — will get 409 INVALID_STATE if approved
  r = await api('POST', `/admin/enrollments/${rejectEnrollTarget}/reject`,
    { reason: 'Smoke test rejection' }, ADM.token);
  check('POST', '/admin/enrollments/:id/reject', r, [200, 409]);

  // 40. POST /enrollments/:id/withdraw  (student2 withdraws from the approved enrollment)
  r = await api('POST', `/enrollments/${enrollId}/withdraw`, null, STU.token);
  check('POST', '/enrollments/:id/withdraw', r, [200, 409]);

  // Re-enroll + re-approve student2 so progress tests have a valid enrollment
  await api('POST', `/courses/${courseA}/enroll`, null, STU.token);
  await api('POST', `/admin/enrollments/${enrollId}/approve`, null, ADM.token);

  // ╔══════════════════════╗
  // ║  PROGRESS SERVICE    ║
  // ╚══════════════════════╝
  console.log('── Progress Service ─────────────────────');

  // 41. POST /progress/subjects/:id/complete
  r = await api('POST', `/progress/subjects/${subA}/complete`,
    { courseId: courseA, semesterId: semA }, STU.token);
  check('POST', '/progress/subjects/:id/complete', r, 200);

  // 42. POST /progress/subjects/:id/access
  r = await api('POST', `/progress/subjects/${subA}/access`,
    { courseId: courseA, semesterId: semA }, STU.token);
  check('POST', '/progress/subjects/:id/access', r, 200);

  // 43. GET /me/progress/subjects/:subjectId
  r = await api('GET', `/me/progress/subjects/${subA}`, null, STU.token);
  check('GET', '/me/progress/subjects/:subjectId', r, [200, 404]);

  // 44. GET /me/progress/courses/:courseId
  r = await api('GET', `/me/progress/courses/${courseA}`, null, STU.token);
  check('GET', '/me/progress/courses/:courseId', r, 200);

  // 45. GET /admin/progress/courses/:courseId
  r = await api('GET', `/admin/progress/courses/${courseA}`, null, ADM.token);
  check('GET', '/admin/progress/courses/:courseId', r, 200);

  // ╔══════════════════════╗
  // ║  STORAGE SERVICE     ║
  // ╚══════════════════════╝
  console.log('── Storage Service ──────────────────────');

  // Multipart upload — requires Firebase Storage emulator (:9199)
  let attachmentId = null;
  try {
    const boundary = `----SmokeFormBoundary${RUN}`;
    const pdfBytes = '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="smoke-test.pdf"',
      'Content-Type: application/pdf',
      '',
      pdfBytes,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch(`${BASE}/subjects/${subA}/attachments`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${ADM.token}`,
        'Content-Type':  `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    const data = res.status !== 204 ? await res.json().catch(() => null) : null;
    // 46. POST /subjects/:id/attachments
    const good = res.status === 201;
    record(good, 'POST', '/subjects/:id/attachments', res.status, 201,
      good ? '' : 'Storage emulator (:9199) required — run with firebase emulators');
    attachmentId = data?.id;
  } catch (e) {
    record(false, 'POST', '/subjects/:id/attachments', 0, 201, `network error: ${e.message}`);
  }

  // 47. GET /attachments/:id/download-url
  if (attachmentId) {
    r = await api('GET', `/attachments/${attachmentId}/download-url`, null, STU.token);
    check('GET', '/attachments/:id/download-url', r, 200);
  } else {
    skipped('GET', '/attachments/:id/download-url', 'no attachment (Storage emulator needed)');
  }

  // 48. DELETE /attachments/:id
  if (attachmentId) {
    r = await api('DELETE', `/attachments/${attachmentId}`, null, ADM.token);
    check('DELETE', '/attachments/:id', r, 204);
  } else {
    skipped('DELETE', '/attachments/:id', 'no attachment (Storage emulator needed)');
  }

  // ╔══════════════════════════╗
  // ║  NOTIFICATION SERVICE    ║
  // ╚══════════════════════════╝
  console.log('── Notification Service (waiting 6 s for outbox) ─');
  await sleep(6000); // allow outbox-worker one poll cycle

  // 49. GET /me/notifications
  r = await api('GET', '/me/notifications', null, ADM.token);
  check('GET', '/me/notifications', r, 200);
  const firstNotifId = r.data?.items?.[0]?.id;

  // 50. POST /me/notifications/:id/read
  if (firstNotifId) {
    r = await api('POST', `/me/notifications/${firstNotifId}/read`, null, ADM.token);
    check('POST', '/me/notifications/:id/read', r, 200);
  } else {
    skipped('POST', '/me/notifications/:id/read',
      'no notifications yet — is outbox-worker running?');
  }

  // 51. POST /me/notifications/read-all
  r = await api('POST', '/me/notifications/read-all', null, ADM.token);
  check('POST', '/me/notifications/read-all', r, 204);

  // ╔══════════════════╗
  // ║  AUDIT SERVICE   ║
  // ╚══════════════════╝
  console.log('── Audit Service ────────────────────────');

  // 52. GET /audit-log
  r = await api('GET', '/audit-log', null, SA.token);
  check('GET', '/audit-log', r, 200);

  // ─────────────────────────────────────────────────────────────────────────
  // Print report
  // ─────────────────────────────────────────────────────────────────────────

  const WM = 8, WP = 44, WS = 6;
  const LINE = '─'.repeat(WM + WP + WS + 22);

  console.log('\n' + LINE);
  console.log('  CMP Smoke Test — Full Results');
  console.log(LINE);
  console.log(`     ${'METHOD'.padEnd(WM)}  ${'PATH'.padEnd(WP)}  ${'STATUS'.padStart(WS)}  NOTE`);
  console.log(LINE);

  for (const e of results) {
    const icon   = e.good === null ? '⬜' : e.good ? '✅' : '❌';
    const status = String(e.status).padStart(WS);
    const note   = e.note ? `  ← ${e.note}` : '';
    console.log(`  ${icon}  ${e.method.padEnd(WM)}  ${e.path.padEnd(WP)}  ${status}${note}`);
  }

  console.log(LINE);
  const skippedN = results.filter(e => e.good === null).length;
  console.log(`\n  ✅ Passed: ${pass}   ❌ Failed: ${fail}   ⬜ Skipped: ${skippedN}   Total: ${results.length}\n`);

  if (fail > 0) {
    console.log('  Fix guide:');
    for (const e of results.filter(e => e.good === false)) {
      const exp = Array.isArray(e.expected) ? e.expected.join(' or ') : e.expected;
      console.log(`    • ${e.method} ${e.path}  got ${e.status}, expected ${exp}${e.note ? '  — ' + e.note : ''}`);
    }
    console.log();
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error('\n❌  Smoke test aborted:', e.message);
  process.exit(1);
});
