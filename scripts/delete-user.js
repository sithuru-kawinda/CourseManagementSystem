'use strict';
/**
 * Soft-delete a user — mirrors what DELETE /users/:uid does in the backend.
 *   1. Sets deletedAt timestamp in Firestore users collection
 *   2. Disables the Firebase Auth account
 *
 * Usage: node scripts/delete-user.js <email>
 * Reversible: yes — run restore-user.js to undo.
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const email = process.argv[2];
if (!email) { console.error('Usage: node scripts/delete-user.js <email>'); process.exit(1); }

const env = {};
fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8').split('\n').forEach(line => {
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
  console.log('\n🗑️   Soft Delete User');
  console.log('────────────────────────────────────────');
  console.log('  Email:', email);
  console.log('────────────────────────────────────────\n');

  // Lookup
  let authUser;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (err) {
    console.error('❌  User not found in Firebase Auth');
    process.exit(1);
  }

  const uid = authUser.uid;
  console.log('  UID  :', uid);
  console.log('  Name :', authUser.displayName || '(not set)');
  console.log('  Role : (checking Firestore...)');

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    console.error('❌  Firestore document not found');
    process.exit(1);
  }

  const data = userDoc.data();
  console.log('\r  Role :', data.role || '(not set)', '  Roles:', (data.roles || []).join(', ') || '(not set)');

  if (data.deletedAt) {
    console.log('\n⚠️  User is already soft-deleted (deletedAt is set). Nothing to do.');
    console.log('   deletedAt:', data.deletedAt);
    process.exit(0);
  }

  const now = new Date();

  // Step 1 — Firestore: set deletedAt
  try {
    await userRef.update({ deletedAt: now });
    console.log('\n✅  Step 1 — Firestore: deletedAt set to', now.toISOString());
  } catch (err) {
    console.error('❌  Step 1 — Firestore update failed:', err.message);
    process.exit(1);
  }

  // Step 2 — Firebase Auth: disable account
  try {
    await auth.updateUser(uid, { disabled: true });
    console.log('✅  Step 2 — Firebase Auth: account disabled');
  } catch (err) {
    console.error('❌  Step 2 — Firebase Auth disable failed:', err.message);
    // Roll back Firestore
    await userRef.update({ deletedAt: null }).catch(() => {});
    console.log('   ↩️  Rolled back Firestore deletedAt to null');
    process.exit(1);
  }

  console.log('\n────────────────────────────────────────');
  console.log('✅  Soft delete complete.');
  console.log(`   ${email} can no longer sign in.`);
  console.log('   To restore: node scripts/restore-user.js', email);
  console.log('────────────────────────────────────────\n');
  process.exit(0);
})();
