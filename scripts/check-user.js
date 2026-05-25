'use strict';
/**
 * Look up a user by email in Firebase Auth + Firestore.
 * Usage: node scripts/check-user.js sapnanethmini128@gmail.com
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/check-user.js <email>');
  process.exit(1);
}

// ── Load credentials from .env.local ───────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌  .env.local not found. Copy .env.example → .env.local and fill in credentials.');
  process.exit(1);
}
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
  console.error('❌  Missing Firebase credentials in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const db   = admin.firestore();
const auth = admin.auth();

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🔍  User Lookup');
  console.log('────────────────────────────────────────');
  console.log('  Email:', email);
  console.log('────────────────────────────────────────\n');

  // 1. Firebase Auth record
  let authUser = null;
  try {
    authUser = await auth.getUserByEmail(email);
    console.log('✅  FIREBASE AUTH — found');
    console.log('   UID               :', authUser.uid);
    console.log('   Display Name      :', authUser.displayName || '(not set)');
    console.log('   Email Verified    :', authUser.emailVerified);
    console.log('   Disabled          :', authUser.disabled);
    console.log('   Providers         :', authUser.providerData.map(p => p.providerId).join(', ') || '(none)');
    console.log('   Created At        :', authUser.metadata.creationTime || '(not set)');
    console.log('   Last Sign-In      :', authUser.metadata.lastSignInTime || '(never)');

    const claims = authUser.customClaims || {};
    console.log('   Custom Claims     :', Object.keys(claims).length ? JSON.stringify(claims) : '(none)');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('❌  FIREBASE AUTH — user NOT found');
    } else {
      console.log('⚠️  FIREBASE AUTH — error:', err.message);
    }
  }

  // 2. Firestore users document
  if (authUser) {
    console.log('\n────────────────────────────────────────');
    try {
      const doc = await db.collection('users').doc(authUser.uid).get();
      if (doc.exists) {
        const d = doc.data();
        console.log('✅  FIRESTORE users — found');
        console.log('   Name              :', `${d.firstName || ''} ${d.lastName || ''}`.trim() || '(not set)');
        console.log('   Role (V1)         :', d.role || '(not set)');
        console.log('   Roles (V2)        :', Array.isArray(d.roles) ? d.roles.join(', ') : '(not set)');
        console.log('   Status            :', d.status || '(not set)');
        console.log('   Preferred Language:', d.preferredLanguage || '(not set)');
        console.log('   Providers stored  :', Array.isArray(d.providers) ? d.providers.join(', ') : '(not set)');
        console.log('   Email Verified    :', d.emailVerified ?? '(not set)');
        console.log('   Deleted At        :', d.deletedAt
          ? (d.deletedAt.toDate ? d.deletedAt.toDate().toISOString() : d.deletedAt)
          : 'null (active)');
        console.log('   Created At        :', d.createdAt ? d.createdAt.toDate().toISOString() : '(not set)');
      } else {
        console.log('❌  FIRESTORE users — document NOT found (Auth record exists but no Firestore doc)');
      }
    } catch (err) {
      console.log('⚠️  FIRESTORE users — error:', err.message);
    }

    // 3. Check for active login lockout
    console.log('\n────────────────────────────────────────');
    try {
      const lockDoc = await db.collection('loginAttempts').doc(email).get();
      if (lockDoc.exists) {
        const l = lockDoc.data();
        const windowMs = 15 * 60 * 1000;
        const windowStart = Date.now() - windowMs;
        const recentFailures = (l.attempts || []).filter(t => t.toMillis() > windowStart);
        const isLocked = recentFailures.length >= 10;
        console.log(`${isLocked ? '🔒' : '✅'}  LOGIN LOCKOUT`);
        console.log('   Total failures (15 min window):', recentFailures.length);
        console.log('   Account locked               :', isLocked ? 'YES — locked' : 'No');
      } else {
        console.log('✅  LOGIN LOCKOUT — no failed attempts on record');
      }
    } catch (err) {
      console.log('⚠️  LOGIN LOCKOUT — error:', err.message);
    }
  }

  console.log('\n────────────────────────────────────────\n');
  process.exit(0);
})();
