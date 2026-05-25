/**
 * Seed V2 role test users into the Firebase Auth + Firestore emulators.
 *
 * Run once (emulators must be running first):
 *   node scripts/seed-v2-roles.js
 *
 * Creates:
 *   leader      leader@cmp.com       Leader@12345   (member + leader roles)
 *   g12         g12leader@cmp.com    G12Lead@123    (member + g12 roles)
 */
process.env.FIRESTORE_EMULATOR_HOST     = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

function resolveProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.firebaserc'), 'utf8'));
    return rc.projects?.default ?? 'demo-cmp';
  } catch (_) {
    return 'demo-cmp';
  }
}

const PROJECT_ID = resolveProjectId();
console.log(`\nProject: ${PROJECT_ID}`);

admin.initializeApp({ projectId: PROJECT_ID });

const auth = admin.auth();
const db   = admin.firestore();

const USERS = [
  {
    email:     'leader@cmp.com',
    password:  'Leader@12345',
    firstName: 'Test',
    lastName:  'Leader',
    roles:     ['member', 'leader'],
    status:    'approved',
  },
  {
    email:     'g12leader@cmp.com',
    password:  'G12Lead@123',
    firstName: 'Test',
    lastName:  'G12',
    roles:     ['member', 'g12'],
    status:    'approved',
  },
];

async function deleteIfExists(email) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.deleteUser(existing.uid);
    console.log(`  removed existing: ${email}`);
  } catch (_) {}
}

async function seed() {
  console.log('\nSeeding V2 role users into Firebase Auth + Firestore emulators…\n');
  const batch = db.batch();
  const now   = new Date().toISOString();

  for (const u of USERS) {
    await deleteIfExists(u.email);

    const record = await auth.createUser({
      email:         u.email,
      password:      u.password,
      displayName:   `${u.firstName} ${u.lastName}`,
      emailVerified: true,   // seed accounts are pre-verified — skip the email-verification gate
    });

    await auth.setCustomUserClaims(record.uid, { role: u.roles[u.roles.length - 1], roles: u.roles });

    batch.set(db.collection('users').doc(record.uid), {
      email:           u.email,
      firstName:       u.firstName,
      lastName:        u.lastName,
      role:            u.roles[u.roles.length - 1],
      roles:           u.roles,
      status:          u.status,
      profilePhotoUrl: null,
      createdAt:       now,
      updatedAt:       now,
      deletedAt:       null,
    });

    console.log(`✓  [${u.roles.join(', ')}]`);
    console.log(`   Email    : ${u.email}`);
    console.log(`   Password : ${u.password}`);
    console.log(`   UID      : ${record.uid}\n`);
  }

  await batch.commit();
  console.log('V2 role users seeded successfully.');
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });
