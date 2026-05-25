'use strict';
/**
 * Creates g12leader@tccr.lk (g12) and leader@tccr.lk (leader)
 * in the ONLINE Firebase project.
 *
 * Run: node scripts/seed-tccr-leaders-online.js
 *
 * Prerequisites:
 *   - .env.local must have FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   - npm install (firebase-admin must be available)
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── Load .env.local credentials ───────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌  .env.local not found at', envPath);
  console.error('    Copy .env.example → .env.local and fill in Firebase credentials.');
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
  console.error('❌  Missing Firebase credentials in .env.local');
  console.error('    Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
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
const db   = admin.firestore();

// ── Users to seed ─────────────────────────────────────────────────────────────
const USERS = [
  {
    email:     'g12leader@tccr.lk',
    password:  'G12Leader@2026',
    firstName: 'G12',
    lastName:  'Leader',
    role:      'g12',
    roles:     ['member', 'g12'],
    status:    'approved',
  },
  {
    email:     'leader@tccr.lk',
    password:  'Leader@2026',
    firstName: 'Cell',
    lastName:  'Leader',
    role:      'leader',
    roles:     ['member', 'leader'],
    status:    'approved',
  },
];

// ── Seed one user ─────────────────────────────────────────────────────────────
async function seedUser(user) {
  console.log(`\n  ── Processing: ${user.email} ──`);

  // Remove existing (idempotent)
  try {
    const existing = await auth.getUserByEmail(user.email);
    await auth.deleteUser(existing.uid);
    console.log(`  ♻️  Removed existing Firebase Auth account`);

    // Also remove existing Firestore doc if any
    const existing_doc = db.collection('users').doc(existing.uid);
    await existing_doc.delete();
    console.log(`  ♻️  Removed existing Firestore document`);
  } catch (_) {
    // No existing account — that's fine
  }

  // Create Firebase Auth account
  const record = await auth.createUser({
    email:         user.email,
    password:      user.password,
    displayName:   `${user.firstName} ${user.lastName}`,
    emailVerified: true,
  });
  console.log(`  ✅  Firebase Auth account created  uid: ${record.uid}`);

  // Set custom claims (role + roles for authorize() middleware)
  await auth.setCustomUserClaims(record.uid, {
    role:  user.role,
    roles: user.roles,
  });
  console.log(`  ✅  Custom claims set: { role: '${user.role}', roles: [${user.roles.map(r => `'${r}'`).join(', ')}] }`);

  // Write Firestore users document
  const now = new Date().toISOString();
  await db.collection('users').doc(record.uid).set({
    email:                   user.email,
    firstName:               user.firstName,
    lastName:                user.lastName,
    role:                    user.role,
    roles:                   user.roles,
    status:                  user.status,
    profilePhotoUrl:         null,
    preferredLanguage:       'en',
    providers:               ['password'],
    fcmTokens:               [],
    notificationPreferences: { email: true, push: true },
    createdAt:               now,
    updatedAt:               now,
    deletedAt:               null,
  });
  console.log(`  ✅  Firestore user document written`);

  return record.uid;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  TCCR Leader Seed — Online Firebase`);
  console.log(`  Project: ${env.FIREBASE_PROJECT_ID}`);
  console.log(`${'═'.repeat(60)}`);

  const results = [];

  for (const user of USERS) {
    const uid = await seedUser(user);
    results.push({ ...user, uid });
  }

  // ── Summary table ────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  ✅  All accounts created successfully!\n');
  console.log('  ┌──────────────────────────────────────────────────────┐');
  for (const u of results) {
    console.log(`  │  Role    : ${u.role.padEnd(40)} │`);
    console.log(`  │  Email   : ${u.email.padEnd(40)} │`);
    console.log(`  │  Password: ${u.password.padEnd(40)} │`);
    console.log(`  │  Roles   : [${u.roles.join(', ')}]${' '.repeat(Math.max(0, 37 - u.roles.join(', ').length))} │`);
    console.log(`  │  UID     : ${u.uid.padEnd(40)} │`);
    console.log('  ├──────────────────────────────────────────────────────┤');
  }
  console.log('  └──────────────────────────────────────────────────────┘');
  console.log('\n  ⚠️  Ask users to change their passwords after first login.\n');

  process.exit(0);
}

main().catch(e => {
  console.error('\n❌  Seed failed:', e.message);
  if (e.code) console.error('    Firebase code:', e.code);
  process.exit(1);
});
