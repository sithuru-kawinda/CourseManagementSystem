'use strict';
/**
 * Restore a soft-deleted user — re-enables Firebase Auth + clears deletedAt in Firestore.
 * Usage: node scripts/restore-user.js <email>
 *
 * Safe to run on accounts that are not deleted — it will report the current state and exit.
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/restore-user.js <email>');
  process.exit(1);
}

// ── Load credentials from .env.local ───────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌  .env.local not found.');
  process.exit(1);
}
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const db   = admin.firestore();
const auth = admin.auth();

(async () => {
  console.log('\n🔧  User Restore');
  console.log('────────────────────────────────────────');
  console.log('  Email:', email);
  console.log('────────────────────────────────────────\n');

  // 1. Get Firebase Auth record
  let authUser;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error('❌  User not found in Firebase Auth. Nothing to restore.');
    } else {
      console.error('❌  Firebase Auth error:', err.message);
    }
    process.exit(1);
  }

  const uid = authUser.uid;
  console.log('  UID      :', uid);
  console.log('  Disabled :', authUser.disabled);

  // Check Firestore doc
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    console.error('❌  Firestore document not found for uid:', uid);
    process.exit(1);
  }

  const data = userDoc.data();
  const isAuthDisabled  = authUser.disabled;
  const isFirestoreDeleted = !!data.deletedAt;

  if (!isAuthDisabled && !isFirestoreDeleted) {
    console.log('\n✅  Account is already active — no restore needed.');
    console.log('   Firebase Auth: enabled');
    console.log('   Firestore deletedAt: null');
    process.exit(0);
  }

  console.log('\n  Current state:');
  console.log('   Firebase Auth disabled  :', isAuthDisabled);
  console.log('   Firestore deletedAt     :', isFirestoreDeleted ? data.deletedAt : 'null');
  console.log('\n  Restoring...\n');

  let step1ok = false;
  let step2ok = false;

  // Step 1 — Re-enable Firebase Auth
  if (isAuthDisabled) {
    try {
      await auth.updateUser(uid, { disabled: false });
      console.log('✅  Step 1 — Firebase Auth re-enabled');
      step1ok = true;
    } catch (err) {
      console.error('❌  Step 1 — Failed to re-enable Firebase Auth:', err.message);
    }
  } else {
    console.log('✅  Step 1 — Firebase Auth already enabled (skipped)');
    step1ok = true;
  }

  // Step 2 — Clear deletedAt in Firestore
  if (isFirestoreDeleted) {
    try {
      await userRef.update({
        deletedAt: null,   // must be null (not FieldValue.delete) — queries use where('deletedAt','==',null)
        status: 'approved',
      });
      console.log('✅  Step 2 — Firestore deletedAt cleared, status set to approved');
      step2ok = true;
    } catch (err) {
      console.error('❌  Step 2 — Failed to update Firestore:', err.message);
    }
  } else {
    console.log('✅  Step 2 — Firestore deletedAt already null (skipped)');
    step2ok = true;
  }

  console.log('\n────────────────────────────────────────');
  if (step1ok && step2ok) {
    console.log('✅  Restore complete. User can now sign in.');
    console.log(`\n   Email : ${email}`);
    console.log(`   UID   : ${uid}`);
    console.log(`   Role  : ${data.role || '(not set)'}`);
    console.log(`   Roles : ${(data.roles || []).join(', ') || '(not set)'}`);
    console.log('\n   ⚠️  Email is not verified. The user will need to verify');
    console.log('      their email before full access is granted.');
  } else {
    console.log('⚠️  Restore partially failed — check errors above.');
  }
  console.log('────────────────────────────────────────\n');

  process.exit(0);
})();
