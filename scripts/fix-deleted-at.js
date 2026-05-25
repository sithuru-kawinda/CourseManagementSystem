'use strict';
/**
 * One-shot fix: set deletedAt to explicit null for a UID.
 * Usage: node scripts/fix-deleted-at.js <uid>
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const uid = process.argv[2];
if (!uid) { console.error('Usage: node scripts/fix-deleted-at.js <uid>'); process.exit(1); }

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

admin.firestore().collection('users').doc(uid)
  .update({ deletedAt: null })
  .then(() => { console.log('✅  deletedAt set to null for uid:', uid); process.exit(0); })
  .catch(e  => { console.error('❌ ', e.message); process.exit(1); });
