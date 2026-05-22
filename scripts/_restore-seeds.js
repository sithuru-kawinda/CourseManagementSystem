'use strict';
/**
 * Restore all seed accounts to their original state before running Newman against online Firebase.
 * Run this once before each Newman session: node scripts/_restore-seeds.js
 */
const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

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

const db = admin.firestore();

const seeds = [
  { email: 'superadmin@cmp.com', password: 'SuperAdmin@123', role: 'super_admin', roles: ['super_admin'] },
  { email: 'admin@cmp.com',      password: 'Admin@12345',    role: 'admin',       roles: ['admin'] },
  { email: 'student1@cmp.com',   password: 'Student1@123',   role: 'student',     roles: ['member', 'student'], status: 'approved' },
  { email: 'student2@cmp.com',   password: 'Student2@123',   role: 'student',     roles: ['member', 'student'], status: 'approved' },
  { email: 'leader@cmp.com',     password: 'Leader@12345',   role: 'leader',      roles: ['member', 'leader']  },
  { email: 'g12leader@cmp.com',  password: 'G12Lead@123',    role: 'g12',         roles: ['member', 'g12']     },
];

async function run() {
  for (const seed of seeds) {
    try {
      const u = await admin.auth().getUserByEmail(seed.email);

      // 1. Fix Firebase Auth
      await admin.auth().updateUser(u.uid, { disabled: false, password: seed.password });
      await admin.auth().setCustomUserClaims(u.uid, { role: seed.role, roles: seed.roles });

      // 2. Fix Firestore document (only fields that tests might corrupt)
      const updates = {
        role:      seed.role,
        roles:     seed.roles,
        deletedAt: null,
      };
      if (seed.status) updates.status = seed.status;
      await db.collection('users').doc(u.uid).update(updates);

      console.log(`✅  ${seed.email} restored`);
    } catch (e) {
      console.error(`❌  ${seed.email}: ${e.message}`);
    }
  }
}

run().finally(() => process.exit(0));
