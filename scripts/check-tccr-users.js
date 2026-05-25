'use strict';
/**
 * Checks whether g12leader@tccr.lk and leader@tccr.lk exist
 * in online Firebase Auth + Firestore.
 *
 * Run: node scripts/check-tccr-users.js
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const envPath = path.resolve(__dirname, '../.env.local');
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

const auth = admin.auth();
const db   = admin.firestore();

const EMAILS = ['g12leader@tccr.lk', 'leader@tccr.lk'];

async function check() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  TCCR User Check — Project:', env.FIREBASE_PROJECT_ID);
  console.log('══════════════════════════════════════════════════\n');

  for (const email of EMAILS) {
    console.log('  ┌── ' + email + ' ─────────────────────────');
    try {
      const user = await auth.getUserByEmail(email);
      const doc  = await db.collection('users').doc(user.uid).get();
      const data = doc.data();

      console.log('  │  Firebase Auth : ✅ FOUND');
      console.log('  │  UID           :', user.uid);
      console.log('  │  Email Verified:', user.emailVerified ? '✅ YES' : '❌ NO');
      console.log('  │  Disabled      :', user.disabled     ? '🚫 YES' : '✅ NO');
      console.log('  │  Custom Claims :', JSON.stringify(user.customClaims ?? {}));
      console.log('  │  Firestore Doc :', doc.exists ? '✅ FOUND' : '❌ MISSING');

      if (doc.exists) {
        console.log('  │  Roles         :', JSON.stringify(data.roles));
        console.log('  │  Status        :', data.status);
        console.log('  │  Providers     :', JSON.stringify(data.providers));
        console.log('  │  DeletedAt     :', data.deletedAt ?? 'null (active ✅)');
      }
    } catch (e) {
      console.log('  │  Firebase Auth : ❌ NOT FOUND');
      console.log('  │  Error         :', e.message);
    }
    console.log('  └─────────────────────────────────────────────\n');
  }

  process.exit(0);
}

check().catch(e => {
  console.error('\n❌ Check failed:', e.message);
  process.exit(1);
});
