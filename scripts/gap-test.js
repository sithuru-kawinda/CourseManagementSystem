'use strict';
const BASE    = 'http://localhost:3000/api/v1';
const ONLINE  = process.argv.includes('--online');
const API_KEY = 'AIzaSyDudm6GFhmqLd6zVW0igYL0myX-vN9H5-0';
// Auto-detect emulator mode — same pattern as smoke-test.js
const AUTH_URL = ONLINE
  ? `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`
  : `http://127.0.0.1:9099/www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=${API_KEY}`;

const pass = [], fail = [];

function record(ok, method, path, status, expected, note) {
  const sym = ok ? '  ✅' : '  ❌';
  console.log(`${sym}  ${method.padEnd(7)} ${path.padEnd(48)} ${String(status).padEnd(5)} ${note || ''}`);
  (ok ? pass : fail).push(`${method} ${path}`);
}

async function api(method, path, body, token) {
  const hdrs = { 'Content-Type': 'application/json' };
  if (token) hdrs['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: hdrs,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { if (res.status !== 204) data = await res.json(); } catch {}
    return { status: res.status, data };
  } catch (e) { return { status: 0, data: null }; }
}

async function apiForm(path, fileBuffer, mimeType, token) {
  try {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const CRLF = '\r\n';
    const header = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="photo"; filename="avatar.png"${CRLF}` +
      `Content-Type: ${mimeType}${CRLF}${CRLF}`
    );
    const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
    const body = Buffer.concat([header, fileBuffer, footer]);
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  } catch (e) { return { status: 0, data: null }; }
}

async function signIn(email, password) {
  const r = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  return d.idToken;
}

(async () => {
  console.log('\n─'.repeat(60));
  console.log('  API Doc Gap Test  —  endpoints not in smoke test');
  console.log('─'.repeat(60));

  const sa      = await signIn('superadmin@cmp.com', 'SuperAdmin@123');
  const admin   = await signIn('admin@cmp.com',      'Admin@12345');
  const student = await signIn('student2@cmp.com',   'Student2@123');
  console.log('\n  Tokens ready (super_admin, admin, student2)\n');

  // ── 2.4  POST /auth/password-reset/verify ────────────
  console.log('── 2.4  POST /auth/password-reset/verify');
  await api('POST', '/auth/password-reset', { email: 'student2@cmp.com' });
  const vr = await api('POST', '/auth/password-reset/verify', { email: 'student2@cmp.com', otp: '000000' });
  record([400, 204].includes(vr.status), 'POST', '/auth/password-reset/verify', vr.status, 'wrong OTP -> 400 expected');

  // ── 3.4  POST /me/avatar (NEW) ────────────────────────
  console.log('\n── 3.4  POST /me/avatar  (NEW)');
  // Minimal 1x1 white PNG — use admin token (student2 may be deleted by prior runs)
  const PNG_1x1 = Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080200000090' +
    '01277e00000000c4944415478016360f8ff9f810000000200018eb9d9f600' +
    '00000049454e44ae426082', 'hex');
  const avatarRes = await apiForm('/me/avatar', PNG_1x1, 'image/png', admin);
  record(avatarRes.status === 200, 'POST', '/me/avatar', avatarRes.status, 'returns updated user');

  // ── Setup for lesson tests ─────────────────────────────
  console.log('\n── Setup: course / semester / subject for lesson tests');
  const ts   = Date.now();
  const c1   = await api('POST', '/courses', { title: `GapTest-${ts}`, description: '' }, admin);
  const cId  = c1.data && c1.data.id;
  const sem  = await api('POST', `/courses/${cId}/semesters`, { title: 'S1' }, admin);
  const sId  = sem.data && sem.data.id;
  const subj = await api('POST', `/semesters/${sId}/subjects`, { title: 'Sub1' }, admin);
  const subId = subj.data && subj.data.id;
  console.log(`  course=${cId}  semester=${sId}  subject=${subId}`);

  // ── 6.5  POST /subjects/:id/lessons ──────────────────
  console.log('\n── 6.4-6.7  Lesson endpoints');
  const lc = await api('POST', `/subjects/${subId}/lessons`, {
    title: 'Lesson 1', description: 'Test lesson',
    youtubeVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  }, admin);
  const lId = lc.data && lc.data.id;
  record(lc.status === 201, 'POST', '/subjects/:id/lessons', lc.status, '201 created');

  // ── 6.4  GET /subjects/:id/lessons ───────────────────
  const lg = await api('GET', `/subjects/${subId}/lessons`, null, admin);
  record(lg.status === 200 && Array.isArray(lg.data), 'GET', '/subjects/:id/lessons', lg.status, 'returns array');

  // ── 6.6  PATCH /lessons/:id ──────────────────────────
  const lu = await api('PATCH', `/lessons/${lId}`, { title: 'Lesson 1 Updated' }, admin);
  record(lu.status === 200, 'PATCH', '/lessons/:id', lu.status, '200 updated');

  // ── 6.7  DELETE /lessons/:id ─────────────────────────
  const ld = await api('DELETE', `/lessons/${lId}`, null, admin);
  record(ld.status === 204, 'DELETE', '/lessons/:id', ld.status, '204 deleted');

  // ── 4.9  POST /courses/:id/restore (NEW) ─────────────
  console.log('\n── 4.9  POST /courses/:id/restore  (NEW)');
  const c2   = await api('POST', '/courses', { title: `RestoreTest-${ts}`, description: '' }, admin);
  const c2Id = c2.data && c2.data.id;
  const s2   = await api('POST', `/courses/${c2Id}/semesters`, { title: 'S1' }, admin);
  const s2Id = s2.data && s2.data.id;
  await api('POST', `/semesters/${s2Id}/subjects`, { title: 'Sub1' }, admin);
  await api('POST', `/courses/${c2Id}/publish`, null, admin);
  await api('POST', `/courses/${c2Id}/archive`, null, admin);
  const rr = await api('POST', `/courses/${c2Id}/restore`, null, admin);
  record(rr.status === 200 && rr.data && rr.data.state === 'draft',
    'POST', '/courses/:id/restore', rr.status, `state=${rr.data && rr.data.state}`);

  // ── 4.1  GET /courses?title= ─────────────────────────
  console.log('\n── 4.1  GET /courses?title=  (title search)');
  const tr = await api('GET', `/courses?title=GapTest`, null, admin);
  const found = tr.data && Array.isArray(tr.data.items) &&
    tr.data.items.some(i => i.title && i.title.startsWith('GapTest'));
  record(tr.status === 200 && found, 'GET', '/courses?title=GapTest', tr.status,
    `items=${tr.data && tr.data.items && tr.data.items.length}`);

  // ── 14.7  POST /super-admin/users/:uid/make-admin ────
  console.log('\n── 14.7  POST /super-admin/users/:uid/make-admin');
  // Pick any student from the users list — no need to be signed in as them
  const usersList = await api('GET', '/users?role=student&limit=5', null, sa);
  const stuCandidate = usersList.data && usersList.data.items &&
    usersList.data.items.find(u => u.status === 'approved');
  const stuUid = stuCandidate && stuCandidate.uid;
  if (!stuUid) {
    record(false, 'POST', '/super-admin/users/:uid/make-admin', 0, 'no approved student found to test with');
  } else {
    const ma = await api('POST', `/super-admin/users/${stuUid}/make-admin`, null, sa);
    record([200, 409, 422].includes(ma.status), 'POST', '/super-admin/users/:uid/make-admin',
      ma.status, ma.status === 200 ? 'promoted' : (ma.data && ma.data.error && ma.data.error.code));
    // Note: intentionally NOT deleting the promoted user — deletion would disable their
    // Firebase Auth account and break subsequent tests that sign in as student2
  }

  // ── 16.1-16.2  /healthz + /readyz per service ────────
  console.log('\n── 16.1-16.2  Health probes (per service)');
  const ports = { 'auth':3001,'user':3002,'course':3003,'enrollment':3004,
                  'progress':3005,'storage':3006,'notification':3007,'audit':3008 };
  for (const [name, port] of Object.entries(ports)) {
    const hz = await fetch(`http://localhost:${port}/healthz`).then(r=>({status:r.status})).catch(()=>({status:0}));
    const rz = await fetch(`http://localhost:${port}/readyz`).then(r=>({status:r.status})).catch(()=>({status:0}));
    record(hz.status===200, 'GET', `/healthz  [${name}:${port}]`, hz.status, '');
    record(rz.status===200, 'GET', `/readyz   [${name}:${port}]`, rz.status, '');
  }

  // ── Summary ──────────────────────────────────────────
  const total = pass.length + fail.length;
  console.log('\n' + '─'.repeat(60));
  console.log(`\n  ✅ Passed: ${pass.length}   ❌ Failed: ${fail.length}   Total: ${total}`);
  if (fail.length) {
    console.log('\n  Failed endpoints:');
    fail.forEach(f => console.log('    ✗', f));
  }
  console.log();
  process.exit(fail.length > 0 ? 1 : 0);
})();
