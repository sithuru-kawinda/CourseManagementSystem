# CMP / TCCR — Postman Collection

API test collection for the **CMP → TCCR backend** (slp-backend).  
**175 requests** across 17 folders covering every V1 and V2 endpoint.

---

## Files in this folder

| File | What it is |
|------|-----------|
| `CMP_Backend.postman_collection.json` | Main collection — all 175 requests |
| `CMP_Local.postman_environment.json` | Local dev environment (Firebase emulator) |
| `CMP_Online.postman_environment.json` | Production environment (online Firebase) |

---

## How to import into Postman

### Step 1 — Import the collection
1. Open Postman
2. Click **Import** (top-left)
3. Drag and drop **`CMP_Backend.postman_collection.json`** (or click *Choose Files*)
4. Click **Import**

### Step 2 — Import an environment
1. Click **Import** again
2. Import **`CMP_Local.postman_environment.json`** for local dev
3. Import **`CMP_Online.postman_environment.json`** for production
4. In the top-right environment selector, choose the one you want to use

### Step 3 — Set the active environment
Click the environment dropdown (top-right of Postman) and select either:
- **CMP — Local Dev (Emulator)** → targets `http://localhost:3000/api/v1`
- **CMP Online (Production)** → targets `https://cms.api.bethelnet.au/api/v1`

---

## Prerequisites before running

### Local Dev environment
```bash
# 1. Start Firebase emulators
npx firebase emulators:start

# 2. Seed test users
node scripts/seed-emulator.js
node scripts/seed-v2-roles.js

# 3. Start all services (Docker)
docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

### Production environment
All services must be deployed and the Firebase project must be live.  
No seed step needed — use real credentials.

---

## Running the collection

### Recommended order
**Always run `🔐 Sign In` first.**  
The sign-in requests save tokens and user IDs into environment variables automatically.  
Every other folder depends on these variables being set.

```
1. 🔐 Sign In              ← run ALL 6 requests here first
2. 1️⃣  Auth Service        ← registers a new member, logout, password reset, federated OAuth
3. Remaining folders       ← each folder builds on the previous (run in order)
```

To run a full folder in sequence: right-click the folder → **Run folder**.

### Running a single request
Select any request and click **Send**.  
Variables like `{{courseId}}`, `{{student2Id}}` must already be set (populated by earlier requests).

---

## Test credentials (Local / Emulator only)

| Role | Email | Password |
|------|-------|----------|
| `super_admin` | `superadmin@cmp.com` | `SuperAdmin@123` |
| `admin` | `admin@cmp.com` | `Admin@12345` |
| `leader` | `leader@cmp.com` | `Leader@12345` |
| `g12` | `g12leader@cmp.com` | `G12Lead@123` |
| `student` (pending) | `student1@cmp.com` | `Student1@123` |
| `student` (approved) | `student2@cmp.com` | `Student2@123` |

---

## Environment variables reference

All tokens and IDs are **auto-set by test scripts** — you never need to paste them manually.

### Auto-set by Sign In folder

| Variable | Set by | Description |
|----------|--------|-------------|
| `superAdminToken` | Sign In — super_admin | Bearer token for super_admin requests |
| `superAdminId` | Sign In — super_admin | UID of the super_admin account |
| `adminToken` | Sign In — admin | Bearer token for admin requests |
| `adminId` | Sign In — admin | UID of the admin account |
| `leaderToken` | Sign In — leader | Bearer token for leader requests |
| `leaderId` | Sign In — leader | UID of the leader — target for promote-leader-to-g12 |
| `g12Token` | Sign In — g12 | Bearer token for g12 requests |
| `g12Id` | Sign In — g12 | UID of the g12 account |
| `studentToken` | Sign In — student2 (approved) | Primary student token used by most tests |
| `student2Token` | Sign In — student2 (approved) | Same as `studentToken` |
| `student2Id` | Sign In — student2 | UID of student2 — primary target for user management tests |
| `student1Token` | Sign In — student1 (pending) | Used only for change-password test |
| `student1Id` | Sign In — student1 | UID of student1 |

### Auto-set by other requests

| Variable | Set by request | Description |
|----------|---------------|-------------|
| `runId` | Auto-generated (prerequest) | Timestamp suffix for unique test emails per run |
| `registeredUid` | Register New Member | UID of the newly registered member |
| `tempMemberToken` | Sign In — New Member (Auth folder) | Disposable token used for logout test |
| `federatedToken` | Federated Login — Google | Token from federated OAuth sign-in |
| `userId` | Get User by ID (Admin) | Mirrors `student2Id` — legacy alias |
| `adminUserId` | Create Admin (Super Admin folder) | UID of the newly created admin |
| `promotedAdminId` | Create Admin (Super Admin folder) | UID of the created admin |
| `createdLeaderId` | Create User Directly (role=leader) | UID of a directly-created leader |
| `createdG12Id` | Create User Directly (role=g12) | UID of a directly-created g12 user |
| `courseId` | Create Course | ID of the test course |
| `semesterId` | Create Semester | ID of the test semester |
| `subjectId` | Create Subject (1st call) | ID of the first test subject |
| `subjectId2` | Create Subject (2nd call) | ID of the second test subject |
| `lessonId` | Create Lesson | ID of the test lesson |
| `batchId` | Create Batch | ID of an open batch (past scheduledOpenAt) |
| `draftBatchId` | Create Batch (DRAFT) | ID of a draft batch |
| `enrollmentId` | Enroll in Course | ID of student2's enrollment |
| `enrollmentId2` | (second enrollment) | ID of second enrollment record |
| `registrationId` | List Registrations | ID of V1 registration record (if any) |
| `roleRequestId` | Create Role Request | ID of the role request |
| `notificationId` | List My Notifications | ID of the first notification |
| `attachmentId` | Upload Attachment | ID of the uploaded PDF attachment |
| `imageAttachmentId` | Upload Subject Image | ID of the uploaded image |
| `cellId` | Create Cell Group | ID of the test cell group |
| `joinRequestId` | Create Join Request | ID of the join request |
| `cellReportId` | File Cell Report | ID of the filed cell report |
| `reportPhotoUrls` | Upload Report Photos | JSON array of pre-uploaded photo URLs |
| `foundMemberUid` | Search Members by Name (Leader) | UID of the first member found |

### Fixed variables (pre-configured in the environment file)

| Variable | Local value | Online value | Notes |
|----------|-------------|--------------|-------|
| `baseUrl` | `http://localhost:3000/api/v1` | `https://cms.api.bethelnet.au/api/v1` | All requests use this |
| `authBaseUrl` | `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1` | `https://identitytoolkit.googleapis.com/v1` | Sign In requests only |
| `firebaseWebApiKey` | `fake-key` | `AIzaSyDudm6...` | Sign In query param |

---

## Collection folder breakdown

| # | Folder | Requests | Caller | Notes |
|---|--------|:--------:|--------|-------|
| 0 | 🔐 Sign In | 6 | — | **Run this first.** Saves all tokens and user IDs. |
| 1 | 1️⃣ Auth Service | 17 | public / any | Register (6 variants: 201, 409, 400×3, si-lang), logout, password reset, OTP verify, track-failure, federated Google, federated Apple. **Register sends welcome email with credentials + login link.** |
| 2 | 2️⃣ User Service — Me | 10 | student | Get/update profile, avatar upload, change password, FCM tokens, notification preferences, OAuth provider link/unlink |
| 3 | 3️⃣ User Service — User Management (Admin / Leader / G12) | 25 | admin / leader / g12 | List users (admin + leader scoped + g12 scoped), search by name (admin/leader/g12), get user (admin/leader/g12 + 403 guard), create user leader/g12, suspend, reactivate, assign roles, promote (5 scenarios), delete user |
| 4 | 4️⃣ User Service — Super Admin | 7 | super_admin | List admins, create admin, get by ID, suspend, reactivate, make-admin, delete admin |
| 5 | 5️⃣ Course Service — Build a Course | 18 | admin | Full course build: create course → semester → 2 subjects → lesson → publish. Includes update and list operations. |
| 6 | 6️⃣ Batches (V2) | 6 | admin / student | Create batch, list, get by ID, update, open, close |
| 7 | 7️⃣ Enrollment | 15 | student / admin | Enroll, list enrollments, list/approve/reject registrations, bulk-approve, list enrollments (admin), **approve enrollment (sends approval email)**, **reject enrollment (sends rejection email)**, withdraw |
| 8 | 8️⃣ Role Requests (V2) | 8 | member / admin | Create, list mine, list all (admin), get by ID (own + 403), download qualification PDF, approve, reject |
| 9 | 9️⃣ Progress Service | 5 | student / admin | Mark subject complete, record access, get course progress (student + admin), get subject progress |
| 10 | 🔔 Notifications | 4 | student | List notifications, mark one read, mark all read, update preferences |
| 11 | 📎 Storage Service | 4 | admin / student | Upload attachment (PDF/DOCX), get download URL, delete attachment, upload subject image |
| 12 | 📋 Audit Log | 3 | admin | List audit log, filter by actor, get per-user timeline |
| 13 | ⚡ Course Lifecycle | 6 | admin | Archive, restore, delete lesson, delete subject, delete semester, delete course |
| 14 | 🏘 V2 — Cell Service | 19 | leader / g12 / admin | Sub-folders: Member Search (2), Cell CRUD (5), Members (2), Join Requests (4), Cell Reports (5), Archive (1) |
| 15 | 📊 V2 — Analytics Service | 10 | g12 / admin | Weekly cells, attendance, meeting types, growth, participation, CSV export, + analytics liveness checks |
| 16 | 🏥 Health Checks | 12 | — | Liveness + readiness probes for all services via gateway |

**Total: 175 requests**

---

## Email notifications triggered by this collection

> Emails are sent asynchronously via the outbox-worker (~5 s after the trigger request). SMTP must be configured (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` in `.env`) or `EMAIL_PROVIDER=console` for local testing.

| Trigger request | Email sent to | Subject |
|----------------|--------------|---------|
| Register New Member (folder 1) | Registered email | `Welcome to TCCR — Your Account is Active` |
| Approve Enrollment (folder 7) | Student's email | `Enrollment Approved — <Course Title> — TCCR` |
| Reject Enrollment (folder 7) | Student's email | `Enrollment Update — <Course Title> — TCCR` |
| Approve Role Request (folder 8) | Member's email | Role grant notification |
| Create Leader / G12 User (folder 3) | New user's email | `Your Cell/G12 Leader Account has been Created — TCCR` |

All login buttons link to `APP_URL` (default `https://cms.bethelnet.au/login`).

---

## Promote endpoint (3️⃣ Users — requests 10–14)

`POST /users/:uid/promote` — elevates a member or leader to a higher role.

| Request | Caller token | Target | Body | Expected |
|---------|-------------|--------|------|---------|
| Promote member → leader | `g12Token` | `{{student2Id}}` | `{"role":"leader"}` | **204** |
| Promote member → g12 | `g12Token` | `{{student2Id}}` | `{"role":"g12"}` | **204** |
| Promote leader → g12 | `leaderToken` | `{{leaderId}}` | `{"role":"g12"}` | **204** |
| Leader tries → leader *(403)* | `leaderToken` | `{{student2Id}}` | `{"role":"leader"}` | **403** |
| Student tries promote *(403)* | `studentToken` | `{{student2Id}}` | `{"role":"g12"}` | **403** |

**Business rules enforced by the backend:**
- `g12` / `admin` / `super_admin` callers → may promote to `leader` or `g12`
- `leader` callers → may only promote to `g12` (cannot create more leaders)
- Targeting an `admin` or `super_admin` always returns 403
- Idempotent — repeated calls with the same role return 204 with no side effects

---

## Newman (automated CLI run)

Run the full collection headlessly against the local emulator stack:

```bash
# Prerequisites: emulators running + docker-compose.local.yml stack up
node scripts/newman-run.js
# Report: postman/newman-report.html

# Cell Service only
node scripts/newman-cell-service.js
# Report: postman/newman-cell-report.html
```

---

## Regenerating the collection

After adding new endpoints, regenerate the collection JSON from source:

```bash
node scripts/build-postman-collection.js
# Overwrites postman/CMP_Backend.postman_collection.json
```
