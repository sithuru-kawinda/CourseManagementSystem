/**
 * Seed all test users into the Firebase Auth + Firestore emulators.
 *
 * Run once (emulators must be running first):
 *   node scripts/seed-emulator.js
 *
 * Creates:
 *   super_admin  superadmin@cmp.com   SuperAdmin@123
 *   admin        admin@cmp.com        Admin@12345
 *   student1     student1@cmp.com     Student1@123   (pending_approval — use to test approval flow)
 *   student2     student2@cmp.com     Student2@123   (pre-approved     — ready for enroll/progress tests)
 */
process.env.FIRESTORE_EMULATOR_HOST     = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// Resolve project ID: env var → .firebaserc default → fallback
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
    email:     'superadmin@cmp.com',
    password:  'SuperAdmin@123',
    firstName: 'Super',
    lastName:  'Admin',
    role:      'super_admin',
    status:    'approved',
  },
  {
    email:     'admin@cmp.com',
    password:  'Admin@12345',
    firstName: 'System',
    lastName:  'Admin',
    role:      'admin',
    status:    'approved',
  },
  {
    email:     'student1@cmp.com',
    password:  'Student1@123',
    firstName: 'Test',
    lastName:  'One',
    role:      'student',
    status:    'pending_approval',   // must go through admin approval
  },
  {
    email:     'student2@cmp.com',
    password:  'Student2@123',
    firstName: 'Test',
    lastName:  'Two',
    role:      'student',
    status:    'approved',           // pre-approved — jump straight to enroll/progress
  },
];

async function deleteIfExists(email) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.deleteUser(existing.uid);
    console.log(`  removed existing: ${email}`);
  } catch (_) {}
}

// Accounts created by the Postman collection during Newman runs — clean them up
// on re-seed so they don't cause 409 conflicts and break variable propagation.
const COLLECTION_GENERATED_EMAILS = ['newadmin@tccr.lk', 'saman.leader@tccr.lk'];

async function seed() {
  console.log('\nSeeding Firebase Auth + Firestore emulators…\n');

  // Clean up any accounts the Postman collection created on previous runs
  for (const email of COLLECTION_GENERATED_EMAILS) {
    await deleteIfExists(email);
  }

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

    // V2: all users get 'member' as their base role in addition to their primary role
    const v2Roles = u.role === 'member' ? ['member'] : ['member', u.role];
    await auth.setCustomUserClaims(record.uid, { role: u.role, roles: v2Roles });

    // users collection (owned by user-service)
    batch.set(db.collection('users').doc(record.uid), {
      email:           u.email,
      firstName:       u.firstName,
      lastName:        u.lastName,
      role:            u.role,
      roles:           v2Roles,
      status:          u.status,
      profilePhotoUrl: null,
      createdAt:       now,
      updatedAt:       now,
      deletedAt:       null,
    });

    // registrations collection (owned by enrollment-service) — students only
    if (u.role === 'student') {
      batch.set(db.collection('registrations').doc(record.uid), {
        id:         record.uid,
        studentUid: record.uid,
        email:      u.email,
        firstName:  u.firstName,
        lastName:   u.lastName,
        state:      u.status === 'approved' ? 'approved' : 'pending',
        reason:     null,
        createdAt:  now,
        updatedAt:  now,
      });
    }

    console.log(`✓  ${u.role.padEnd(12)} ${u.email}`);
    console.log(`   Password : ${u.password}`);
    console.log(`   UID      : ${record.uid}`);
    console.log(`   Status   : ${u.status}\n`);
  }

  await batch.commit();
  console.log('All users seeded successfully.');
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });
