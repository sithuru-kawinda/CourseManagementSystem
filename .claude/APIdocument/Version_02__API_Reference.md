# TCCR — API Reference Document
## The Christian Center Rathmalana · `tccr-backend`
### REST API · Version 2.19.0 · Base URL: `https://cms.api.bethelnet.au/api/v1`

**Version:** 2.19.0
**Date:** 24 May 2026
**Organisation:** Future CX Lanka (Pvt) Ltd
**Status:** Release Baseline
**Supersedes:** Version 2.18.0 (24 May 2026)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Auth Endpoints](#2-auth-endpoints)
   - 2.1 [Register](#21-post-authregister) · 2.2 [Google](#22-post-authfederatedgoogle--new-v2) · 2.3 [Apple](#23-post-authfederatedapple--new-v2) · 2.4 [Logout](#24-post-authlogout)
   - 2.5 [Password Reset](#25-post-authpassword-reset) · 2.6 [Verify OTP](#26-post-authpassword-resetverify) · 2.7 [Track Failure](#27-post-authtrack-failure)
   - **2.8 [Resend Verification](#28-post-authresend-verification--new) ★** · **2.9 [Verify Email OTP](#29-post-authverify-email--new) ★**
3. [Profile Endpoints (Me)](#3-profile-endpoints-me)
   - 3.1 [Get Profile](#31-get-me) · 3.2 [Update Profile](#32-patch-me) · 3.3 [Change Password](#33-post-mechange-password)
   - 3.4 [Upload Avatar](#34-post-meavatar) · 3.5 [Upload Qualification](#35-post-mequalification--new) · 3.6 [Link Provider](#36-post-meproviders-link--new-v2) · 3.7 [Unlink Provider](#37-delete-meproviders-provider--new-v2)
   - 3.8 [Register FCM Token](#38-post-mefcm-token--new-v2) · 3.9 [Deregister FCM Token](#39-delete-mefcm-token--new-v2) · 3.10 [Notification Preferences](#310-patch-menotificationspreferences--new-v2)
4. [User Management — Admin](#4-user-management--admin)
   - 4.1 [List Users](#41-get-users) · 4.2 [Get User](#42-get-usersuid) · 4.3 [Assign Roles](#43-patch-usersuidroles--new-v2)
   - 4.4 [User Audit Log](#44-get-usersuidaudit-log--new-v2) · 4.5 [Suspend](#45-post-usersusidsuspend) · 4.6 [Reactivate](#46-post-usersuidreactivate)
   - 4.7 [Provision Leader/G12 User (with welcome email)](#47-post-users--new) · 4.8 [Promote Existing User](#48-post-usersuidpromote--new-v2) · 4.9 [Delete User ★](#49-delete-usersuid--new)
5. [Role Requests — NEW V2](#5-role-requests--new-v2)
   - 5.1 [Submit Role Request (multipart)](#51-post-role-requests) · 5.2 [My Requests](#52-get-role-requestsmine) · 5.3 [Admin List](#53-get-role-requests)
   - 5.4 [Get Request](#54-get-role-requestsid) · 5.5 [Download Qualification PDF ★](#55-get-role-requestsidqualification) · 5.6 [Approve](#56-post-role-requestsidapprove) · 5.7 [Reject](#57-post-role-requestsidreject)
6. [Course Endpoints](#6-course-endpoints)
   - 6.1–6.7 [List/Get/Create/Update/Publish/Unpublish/Archive](#61-get-courses)
   - 6.8 [Restore Course](#68-post-coursesidrestore) · 6.9 [Delete Course](#69-delete-coursesid)
7. [Batch Endpoints — NEW V2](#7-batch-endpoints--new-v2)
   - 7.1 [List Batches](#71-get-coursesidbatches)
   - 7.2 [Create Batch](#72-post-coursesidbatches)
   - 7.3 [Get Batch](#73-get-batchesid)
   - 7.4 [Update Batch](#74-patch-batchesid)
   - 7.5 [Open Batch (Manual)](#75-post-batchesidopen)
   - 7.6 [Close Batch (Manual)](#76-post-batchesidclose)
8. [Semester Endpoints](#8-semester-endpoints)
9. [Subject & Lesson Endpoints](#9-subject--lesson-endpoints)
10. [Attachment & Image Endpoints](#10-attachment--image-endpoints)
11. [Enrollment Endpoints](#11-enrollment-endpoints)
12. [Progress Endpoints](#12-progress-endpoints)
13. [Cell Group Endpoints — NEW V2](#13-cell-group-endpoints--new-v2)
    - 13.1 [List Cells](#131-get-cells)
    - 13.2 [My Cells](#132-get-cellsmine)
    - 13.3 [Create Cell](#133-post-cells)
    - 13.4 [Get Cell](#134-get-cellsid)
    - 13.5 [Update Cell](#135-patch-cellsid)
    - 13.6 [Archive Cell](#136-post-cellsidarchive)
    - 13.7 [Delete Cell ★ NEW](#137-delete-cellsid--new) · **13.7b [Transfer Ownership ★ NEW](#137b-post-cellsidtransfer-ownership--new)** · 13.8 [Add Members (Direct)](#138-post-cellsidmembers)
    - 13.9 [Remove Member](#138-delete-cellsidmembersuid)
    - 13.10 [Apply to Join (Member)](#139-post-cellsidjoin-requests)
    - 13.11 [List Join Requests](#1310-get-cellsidjoin-requests)
    - 13.12 [Approve Join Request](#1311-post-cellsidjoin-requestsridapprove)
    - 13.13 [Reject Join Request](#1312-post-cellsidjoin-requestsridreject)
14. [Cell Report Endpoints — NEW V2](#14-cell-report-endpoints--new-v2)
   - **14.6 [Network Reports (G12 view) ★ NEW](#146-get-cellsnetworkreports--new)**
15. [Analytics Endpoints — NEW V2](#15-analytics-endpoints--new-v2)
16. [Notification Endpoints](#16-notification-endpoints)
17. [Audit Log Endpoints](#17-audit-log-endpoints)
18. [Admin Management — Super Admin](#18-admin-management--super-admin)
19. [Health Endpoints](#19-health-endpoints)
20. [Data Models](#20-data-models)
21. [Error Codes Reference](#21-error-codes-reference)
22. [HTTP Status Code Reference](#22-http-status-code-reference)
23. [Domain Events Reference](#23-domain-events-reference)

---

## 1. Getting Started

### 1.1 Base URL & Versioning

```
Production:  https://api.tccr.lk/api/v1
Staging:     https://api-staging.tccr.lk/api/v1
Local Dev:   http://localhost:3000/api/v1
```

### 1.2 Authentication

The TCCR API uses Firebase Authentication with stateless Bearer tokens.

```
Authorization: Bearer <firebase-id-token>
```

- Firebase ID tokens expire after **1 hour**; always call `user.getIdToken()` before each request
- Revoked tokens are rejected immediately (`checkRevoked=true`)
- **V2 locale header:** `Accept-Language: si` or `Accept-Language: ta` to receive localised notifications and responses; falls back to user's `preferredLanguage` profile field, then `en`

**Public endpoints (no token required):**

> **Email-verification gate:** After registration, all protected endpoints return `403 EMAIL_NOT_VERIFIED` until the user submits their OTP via `POST /auth/verify-email`. Federated users (Google/Apple) are exempt — Firebase marks them as verified automatically.

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Member registration |
| `POST /auth/federated/google` | Google sign-in |
| `POST /auth/federated/apple` | Apple sign-in |
| `POST /auth/password-reset` | Request OTP |
| `POST /auth/password-reset/verify` | Verify OTP |
| `POST /auth/track-failure` | Record failed login attempt |
| `GET /courses` | Browse published catalogue |
| `GET /courses/:id` | View published course |
| `GET /healthz` | Liveness probe |
| `GET /readyz` | Readiness probe |

### 1.3 Request Format

- JSON bodies: `Content-Type: application/json`
- File uploads: `multipart/form-data`
- Optional: `X-Request-Id` (UUID v4); server generates if absent
- **Required** on `POST /cells/:id/reports`: `X-Idempotency-Key: <client-uuid>`

### 1.4 Response Format

```json
// Single resource
{ "id": "abc", "name": "...", "createdAt": "2026-05-01T08:00:00.000Z" }

// Paginated list
{ "items": [...], "nextCursor": "abc123", "total": 47 }

// Empty success
HTTP 204 No Content
```

### 1.5 Error Format

```json
{
  "error": {
    "code":    "BATCH_CLOSED",
    "message": "Target batch has closed its intake window.",
    "details": { "batchId": ["Intake window closed on 2026-04-30"] }
  },
  "requestId": "7f3a1c2d-4e5b-6f7a-8b9c-0d1e2f3a4b5c"
}
```

### 1.6 Pagination

| Parameter | Default | Max | Description |
|-----------|:-------:|:---:|-------------|
| `limit` | 20 | 100 | Items per page |
| `cursor` | — | — | Value from previous `nextCursor` |

### 1.7 Rate Limiting

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| `POST /auth/*` | 10 | Per IP per minute |
| All other endpoints | 200 | Per IP per minute |

Returns `429 Too Many Requests` with `Retry-After` header.

### 1.8 Performance & Usability Constraints

The following SRS non-functional requirements directly constrain API behaviour and client implementation:

| Requirement | Constraint | SRS Ref |
|-------------|-----------|---------|
| API response time | p95 GET latency < **800 ms** at 50 RPS steady state | NFR-PER-001 |
| Analytics dashboards | All `/analytics/*` responses < **2 s** (served from pre-aggregated snapshots, never raw scans) | NFR-PER-003 |
| Registered users | Designed for **10,000 registered users** | NFR-SCA-001 |
| Concurrent cells | System must sustain **500 concurrent cells**, **100,000 cell reports/year** | NFR-SCA-002 |
| Cell report UX | A Leader must be able to complete and submit a cell report in **under 3 minutes** on mobile. Clients should pre-populate attendance from the roster and default `date` to today (FR-CR-003). | NFR-USA-003 |
| Offline cell reports | Clients may queue reports offline and retry for up to **24 hours** using the `X-Idempotency-Key` header. Same key always returns the existing report (`200 OK`) rather than a duplicate. | NFR-AVA-004 |
| Token refresh | Firebase ID tokens expire in 1 hour. Always call `user.getIdToken(true)` before requests after idle periods. Inactivity timeout is **30 minutes** on web (FR-AUTH-008). | NFR-SEC-002 |
| TLS | All traffic must use **TLS 1.2+**. Plain HTTP is rejected at the load balancer. | NFR-SEC-001 |
| Injection prevention | All request bodies are Zod-validated server-side. Clients must not rely on client-side sanitisation as a security boundary. | NFR-SEC-007 |
| CORS | Only configured origins are allowed. Wildcard (`*`) is never permitted in production. | NFR-SEC-009 |
| Audit log integrity | `audit_log` entries are append-only. No update or delete operation exists on audit entries. | NFR-SEC-011 |

### 1.9 Role Summary V2

Roles are **additive** — a user holds multiple roles simultaneously (e.g. `["member","student","leader"]`). The `member` role is assigned automatically on registration and **can never be removed**. `super_admin` inherits all `admin` permissions.

| Role | How Assigned | Key Capabilities |
|------|-------------|-----------------|
| `member` | Auto on registration | View system; apply for Bible School; apply to join cell group; view own cell (read-only) |
| `student` | Admin approves role request | Everything member can do + browse course batches; apply to enroll; access approved course content; track progress |
| `leader` | Admin/Super Admin assigns after physical request | Everything member can do + create cell groups; add members to cells; fill cell reports; view own-cell analytics |
| `g12` | Admin/Super Admin/G12 assigns after physical request | Everything leader can do + promote `leader` → `g12`; view network-wide analytics dashboard |
| `admin` | Super Admin creates | Approve student role requests; approve cell group join requests; approve course enrollments; assign `leader`/`g12` roles; manage courses/users; view per-user audit log. **Cannot file cell reports** |
| `super_admin` | Platform owner | All admin capabilities + create admin accounts + assign any role |

> A member can follow **two paths** after registration — apply for Bible School and/or apply to join a Cell Group — both require Admin or Super Admin approval.

---

## 2. Auth Endpoints

---

### 2.1 `POST /auth/register`

Register a new account. **V2:** Creates an **active Member** immediately — no approval queue. V1 created a `pending_approval` Student.

**Authentication:** None (public)  
**Content-Type:** `application/json`

#### Request Body

```json
{
  "firstName":         "Viruli",
  "lastName":          "Weerasinghe",
  "email":             "viruli@example.com",
  "password":          "SecurePass1@",
  "preferredLanguage": "si"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | string | Yes | 1–100 chars |
| `lastName` | string | Yes | 1–100 chars |
| `email` | string | Yes | Valid RFC-5322 email · must be unique |
| `password` | string | Yes | Min **10 chars** · ≥1 uppercase · ≥1 lowercase · ≥1 digit · ≥1 special char |
| `preferredLanguage` | string | No | `"en"` \| `"si"` \| `"ta"` — defaults to `"en"` |

#### Side Effects (on `201`)

| Step | Detail |
|------|--------|
| 1 | Firebase Auth account created with the supplied email + password |
| 2 | Firebase custom claims set: `{ role: "member", roles: ["member"] }` |
| 3 | Firestore user doc created: `status: "approved"`, `roles: ["member"]` |
| 4 | `user.registered` event published to the outbox |
| 5 | Outbox-worker dispatches (~5 s) → **`UserRegisteredHandler`** runs: |
|   | &nbsp;&nbsp;• In-app notification to all Admins: *"New Member Joined"* |
|   | &nbsp;&nbsp;• **Welcome email** sent to the registrant (see below) |

#### Welcome Email

| Field | Value |
|-------|-------|
| **To** | Registered email address |
| **Subject** | `Welcome to TCCR — Your Account is Active` |
| **Greeting** | `Hi <firstName> <lastName>,` |
| **Credentials table** | Email address + plain-text password |
| **Warning** | ⚠ Prompt to change password after first login |
| **Login button** | `Log in to TCCR →` — links to `APP_URL` env var (default `https://cms.bethelnet.au/login`) |
| **Footer** | Security note: contact support if account was not created by the user |

> **Environment variable:** `APP_URL` controls the login button link in **all** welcome emails (member registration + leader/g12/admin creation). Set it in `.env`:
> ```
> APP_URL=https://cms.bethelnet.au/login
> ```
> Default: `https://cms.bethelnet.au/login`
>
> **Email delivery:** Configured via `EMAIL_PROVIDER` (`sendgrid` \| `smtp` \| `console`). Delivery is retried 3× with 1 s → 2 s → 4 s backoff. A delivery failure is logged but never surfaces to the client — `201` is always returned if account creation succeeds.

#### Responses

**`201 Created`**
```json
{ "uid": "Xf3aBC...", "message": "Registration successful. You are now an active member." }
```

**`400 Bad Request`** — Zod validation failure (missing field, weak password, invalid email)
```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "password: Password must be at least 10 characters." },
  "requestId": "..."
}
```

| Validation Rule | Error message |
|----------------|--------------|
| `firstName` missing or empty | `firstName: Required` |
| `lastName` missing or empty | `lastName: Required` |
| `email` not valid RFC-5322 | `email: Invalid email` |
| `password` < 10 chars | `password: Password must be at least 10 characters.` |
| `password` missing uppercase | `password: Password must contain an uppercase letter.` |
| `password` missing lowercase | `password: Password must contain a lowercase letter.` |
| `password` missing digit | `password: Password must contain a number.` |
| `password` missing special char | `password: Password must contain a special character.` |
| `preferredLanguage` not `en`/`si`/`ta` | `preferredLanguage: Invalid enum value` |

**`409 Conflict`** — Email already registered (checked against both user-service and Firebase Auth)
```json
{ "error": { "code": "EMAIL_EXISTS", "message": "Email address already registered." }, "requestId": "..." }
```

---

### 2.2 `POST /auth/federated/google` — NEW V2

Exchange a Google ID token for a Firebase session (FR-AUTH-003). Creates an active Member if email is new. Google token is discarded after exchange — never persisted (NFR-SEC-006).

**Authentication:** None (public)

```json
{ "idToken": "<google-id-token>", "preferredLanguage": "en" }
```

**`200 OK`**
```json
{ "firebaseToken": "<firebase-custom-token>", "uid": "Xf3aBC...", "isNewUser": false }
```

> Client exchanges `firebaseToken` via `signInWithCustomToken()`.

**`401 Unauthorized`** → `FEDERATED_TOKEN_INVALID`

---

### 2.3 `POST /auth/federated/apple` — NEW V2

Exchange an Apple identity token for a Firebase session (FR-AUTH-004). Same semantics as Google flow.

**Authentication:** None (public)

```json
{ "idToken": "<apple-identity-token>", "preferredLanguage": "en" }
```

Same response shape as `POST /auth/federated/google`.

---

### 2.4 `POST /auth/logout`

Revoke all refresh tokens for the authenticated user.

**Authentication:** Bearer required | **Roles:** Any

**`204 No Content`**

---

### 2.5 `POST /auth/password-reset`

Send 6-digit OTP to the given email. OTP valid 15 min. Always `204` regardless of whether email exists.

**Authentication:** None (public)

```json
{ "email": "viruli@example.com" }
```

**`204 No Content`**

---

### 2.6 `POST /auth/password-reset/verify`

Verify OTP and dispatch Firebase password-reset email.

**Authentication:** None (public)

```json
{ "email": "viruli@example.com", "otp": "482910" }
```

**`204 No Content`** | **`400`** → `INVALID_OTP` / `OTP_EXPIRED` / `OTP_MAX_ATTEMPTS`

---

### 2.7 `POST /auth/track-failure`

Record a failed login attempt. After **10 consecutive failures in 15 minutes**, account is locked for 15 minutes and the user is notified (FR-AUTH-009). Locks clear automatically after the window expires — no admin action required.

**Authentication:** None (public)

```json
{ "email": "viruli@example.com" }
```

**`200 OK`**
```json
{ "locked": false, "attempts": 3 }
```

---

### 2.8 `POST /auth/resend-verification` ★ NEW

Resend a 6-digit email verification OTP. Always returns `204` even if the email is not found (prevents enumeration). OTP expires in 15 minutes.

**Authentication:** None (public) | **Content-Type:** `application/json`

**Request Body:** `{ "email": "user@example.com" }`

| Response | Condition |
|----------|-----------|
| `204 No Content` | OTP sent (or email not found — silent) |
| `400 EMAIL_ALREADY_VERIFIED` | Email is already verified |
| `400 VALIDATION_ERROR` | Invalid email format |

---

### 2.9 `POST /auth/verify-email` ★ NEW

Verify email with a 6-digit OTP from the welcome email. Sets `emailVerified = true` in Firebase Auth on success — all protected routes then become accessible.

**Authentication:** None (public) | **Content-Type:** `application/json`

**Request Body:** `{ "email": "user@example.com", "otp": "748349" }`

| Field | Required | Validation |
|-------|:--------:|-----------|
| `email` | Yes | Valid RFC-5322 email |
| `otp` | Yes | Exactly 6 digits |

**OTP Rules:** 15-minute TTL · max 5 wrong attempts (then deleted) · on success: `emailVerified=true` in Firebase Auth

| Response | Condition |
|----------|-----------|
| `204 No Content` | Email verified ✅ |
| `400 INVALID_OTP` | Wrong code (shows remaining attempts) |
| `400 OTP_EXPIRED` | Code has expired — call `POST /auth/resend-verification` |
| `400 OTP_MAX_ATTEMPTS` | 5 failed attempts — call `POST /auth/resend-verification` |

---

## 3. Profile Endpoints (Me)

---

### 3.1 `GET /me`

Get the authenticated user's full profile.

**Authentication:** Bearer required | **Roles:** Any

**`200 OK`**
```json
{
  "uid":                     "firebase-uid-abc123",
  "email":                   "viruli@example.com",
  "firstName":               "Viruli",
  "lastName":                "Weerasinghe",
  "preferredLanguage":       "si",
  "roles":                   ["member", "student"],
  "providers":               ["password"],
  "status":                  "approved",
  "profilePhotoUrl":         "https://storage.googleapis.com/...",
  "notificationPreferences": { "email": true, "push": true },
  "createdAt":               "2026-05-01T08:00:00.000Z",
  "updatedAt":               "2026-05-05T10:30:00.000Z"
}
```

---

### 3.2 `PATCH /me`

Update own profile. `email`, `roles`, `status` are immutable through this endpoint.

**Authentication:** Bearer required | **Roles:** Any

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | string | No | 1–100 chars |
| `lastName` | string | No | 1–100 chars |
| `profilePhotoUrl` | string\|null | No | Valid URL or null |
| `phoneNumber` | string\|null | No | International format e.g. `+94771234567` |
| `preferredLanguage` | string | No | `en` \| `si` \| `ta` |
| `dateOfBirth` | string\|null | No | `YYYY-MM-DD` |
| `gender` | string\|null | No | `male` \| `female` \| `other` |
| `address` | string\|null | No | 1–500 chars |
| `qualifications` | array | No | Ordered list of qualification entries — see shape below |

**`qualifications[]` item shape:**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | string | Yes | Client-generated UUID — used to identify the entry |
| `title` | string | Yes | Qualification name — no length limit |
| `fileUrl` | string\|null | No | URL returned by `POST /me/qualification`; `null` if no PDF attached |

> The first entry (`qualifications[0]`) is automatically used as the primary qualification when submitting a role request via `POST /role-requests`. `dateOfBirth`, `gender`, and `address` are also required before submitting.

**`200 OK`** — Updated User object (includes `qualifications` array).

---

### 3.3 `POST /me/change-password`

Change password. Verified via Firebase Identity Toolkit.

**Authentication:** Bearer required | **Roles:** Any

```json
{ "currentPassword": "OldPass1", "newPassword": "NewPass2" }
```

**`204 No Content`**

---

### 3.4 `POST /me/avatar`

Upload or replace the authenticated user's profile photo. Stored under `avatars/{uid}.{ext}` in Firebase Storage; the resulting public URL is saved as `profilePhotoUrl` on the user document.

**Authentication:** Bearer required | **Roles:** Any
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `photo` | file | Yes | `image/jpeg` or `image/png` · max **2 MB** |

**`200 OK`**
```json
{ "profilePhotoUrl": "https://storage.googleapis.com/bucket/avatars/uid.jpg" }
```

**`400 Bad Request`** → `VALIDATION_ERROR` (wrong MIME type or file too large)

---

### 3.5 `POST /me/qualification` ★ NEW

Upload a qualification PDF to Firebase Storage and receive a download URL.

> **Stateless** — this endpoint does **not** save anything to the user profile. The returned `fileUrl` must be included in the `qualifications[].fileUrl` field when calling `PATCH /me` (§3.2) to persist the qualification. This design supports multiple qualification entries — each PDF gets a unique UUID-namespaced path so uploads never overwrite each other.

**Flow:**
1. `POST /me/qualification` → receive `{ fileUrl }`
2. Store `fileUrl` alongside the qualification title in the `qualifications[]` array
3. `PATCH /me` with `{ qualifications: [{ id, title, fileUrl }, ...] }` to save

**Authentication:** Bearer required | **Roles:** Any
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `qualification` | file | Yes | PDF only · max **10 MB** · field name `qualification` |

**`200 OK`**
```json
{
  "fileUrl": "https://firebasestorage.googleapis.com/v0/b/bucket/o/qualifications%2Fuid%2Fuuid.pdf?alt=media&token=..."
}
```

**`400 Bad Request`** → `VALIDATION_ERROR` — no file attached

**`413 Payload Too Large`** → `FILE_TOO_LARGE` — file exceeds 10 MB

**`415 Unsupported Media Type`** → `UNSUPPORTED_MEDIA_TYPE` — file is not a PDF

---

### 3.6 `POST /me/providers/link` — NEW V2

Link a Google or Apple identity to the account (FR-AUTH-010).

**Authentication:** Bearer required | **Roles:** Any

```json
{ "provider": "google", "idToken": "<google-id-token>" }
```

**`200 OK`** → `{ "providers": ["password", "google.com"] }`

---

### 3.7 `DELETE /me/providers/:provider` — NEW V2

Unlink a federated provider. Cannot remove the only remaining sign-in method (FR-AUTH-010).
`:provider` — `google` or `apple`

**Authentication:** Bearer required | **Roles:** Any

**`200 OK`** → `{ "providers": ["password"] }`

**`409 Conflict`** → `INVALID_STATE`

---

### 3.8 `POST /me/fcm-token` — NEW V2

Register/refresh an FCM push token. Call after every login and on token rotation (SRS §8.1.1).

**Authentication:** Bearer required | **Roles:** Any

```json
{ "token": "<fcm-token>" }
```

**`204 No Content`**

---

### 3.9 `DELETE /me/fcm-token` — NEW V2

Remove FCM token on logout or invalidation.

**Authentication:** Bearer required | **Roles:** Any

```json
{ "token": "<fcm-token>" }
```

**`204 No Content`**

---

### 3.10 `PATCH /me/notifications/preferences` — NEW V2

Update per-channel notification opt-out (FR-NOT-006). Essential notifications always delivered in-app regardless.

**Authentication:** Bearer required | **Roles:** Any

```json
{ "email": true, "push": false }
```

**`200 OK`** → `{ "email": true, "push": false }`

---

## 4. User Management — Admin

---

### 4.1 `GET /users`

List users with filtering.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`

> **Scoped view for `leader` / `g12`:** These callers only see users with `status: "approved"` and without `admin` or `super_admin` roles — i.e. members, students, and other leaders/g12s. Admin callers see the full unfiltered list.

| Parameter | Type | Description |
|-----------|------|-------------|
| `role` | string | Filter by single role — `member` \| `student` \| `leader` \| `g12` \| `admin` \| `super_admin` |
| `status` | string | `pending_approval` \| `approved` \| `rejected` \| `suspended` |
| `name` | string | Case-sensitive prefix search on `firstName` (min 1, max 100 chars) |
| `limit` | number | 1–100, default 20 |
| `cursor` | string | Cursor from previous `nextCursor` |

**`200 OK`** — Paginated User list.

---

### 4.2 `GET /users/:uid`

Get a specific user's profile.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

> **Scoped access for `leader` / `g12`:** These callers can look up any non-admin user. Attempting to fetch a user who holds `admin` or `super_admin` returns `403 FORBIDDEN`.

**`200 OK`** — User object.

**`403 Forbidden`** → `FORBIDDEN` — leader/g12 attempted to fetch an admin profile

**`404 Not Found`** → `USER_NOT_FOUND`

---

### 4.3 `PATCH /users/:uid/roles` — NEW V2

Add or remove a **single role** per request. Role change rules:

| Caller | Can add | Can remove | Cannot |
|--------|---------|-----------|--------|
| `super_admin` | Any role except `super_admin` on others | Any role | Demote last super_admin |
| `admin` | `student`, `leader`, `g12` | `student`, `leader`, `g12` | Touch `admin` or `super_admin` |
| `g12` | `leader`, `g12` | `leader`, `g12` | Touch `admin`, `super_admin`, or `member` |

> `member` can never be removed from any user. Dual-write: every role mutation updates **both** Firestore `roles[]` and Firebase Auth custom claims atomically.

**Authentication:** Bearer required | **Roles:** `admin`, `g12` (super_admin inherits admin)

```json
{ "role": "leader", "action": "add" }
```

| Field | Type | Required | Values |
|-------|------|:--------:|--------|
| `role` | string | Yes | Any `UserRole` |
| `action` | string | Yes | `"add"` or `"remove"` |

**`204 No Content`**

**`403 Forbidden`** → `FORBIDDEN` — caller does not have permission to assign this role

**`409 Conflict`** → `LAST_SUPER_ADMIN`

---

### 4.4 `GET /users/:uid/audit-log` — NEW V2

Per-user audit timeline — entries where user was actor or target (FR-SADM-005 / FR-ADM-005).

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `action` | Filter by action key |
| `from`, `to` | ISO datetime range |
| `limit`, `cursor` | Pagination |

**`200 OK`**
```json
{
  "items": [
    {
      "id": "log-001", "when": "2026-05-15T10:00:00.000Z",
      "actor": { "uid": "admin-uid", "email": "admin@tccr.lk" },
      "action": "role.granted", "category": "enrollment",
      "targetType": "user", "targetId": "Xf3aBC...",
      "requestId": "7f3a-..."
    }
  ],
  "nextCursor": null, "total": 12
}
```

---

### 4.5 `POST /users/:uid/suspend`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

```json
{ "reason": "Policy violation." }
```

**`200 OK`** — Updated User with `status: "suspended"`.

---

### 4.6 `POST /users/:uid/reactivate`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**`200 OK`** — Updated User with `status: "approved"`.

---

### 4.7 `POST /users` — NEW

Provision a brand-new **leader** or **g12** account for a person who is **not yet registered** in the system. Both a Firebase Auth login and a Firestore user record are created atomically — the user can sign in immediately with the `initialPassword` provided.

Use this when a G12 leader, admin, or super admin needs to on-board a cell leader or G12 leader without requiring self-registration or the role-request flow. For admin accounts use `POST /super-admin/admins` instead.

> **Why this endpoint exists:** `PATCH /users/:uid/roles` can only update an already-registered user's roles — it cannot create a Firebase Auth account for a brand-new person. This endpoint fills that gap.

**Side effects:**
- Firebase Auth account created with `initialPassword`
- Firestore user record created with `roles: ["member", "<role>"]` and `status: "approved"`
- An `admin.created` outbox event is published → `AdminCreatedHandler` sends a **role-specific welcome email**:

  | Condition | Email content |
  |-----------|--------------|
  | `role = "leader"` or `"g12"` | Full welcome with credentials table (email + temp password) + **"Set Your Password →"** button (Firebase reset link, 1 hr TTL) + system URL |
  | `promoted: true` (admin promotion path) | Short promotion notice — no password shown |
  | Default (admin account) | Legacy admin welcome with credentials + reset link |

- Audit log entry written (`audit.action`)

**Authentication:** Bearer required | **Roles:** `g12`, `admin`, `super_admin`

> **Caller restrictions:** A **g12** caller may provision both `leader` and `g12` accounts. An **admin / super_admin** caller may provision any `leader` or `g12` account.

#### Request Body

```json
{
  "firstName":       "Saman",
  "lastName":        "Silva",
  "email":           "saman@tccr.lk",
  "initialPassword": "Leader@12345",
  "role":            "leader"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | string | Yes | 1–50 chars |
| `lastName` | string | Yes | 1–50 chars |
| `email` | string | Yes | Valid email; must be unique |
| `initialPassword` | string | Yes | Min 8 characters |
| `role` | string | Yes | `"leader"` or `"g12"` only |

#### Responses

**`201 Created`** — Full User object. The user is `status: "approved"` and holds `roles: ["member", "<role>"]`.

```json
{
  "uid":             "firebase-uid-abc123",
  "email":           "saman@tccr.lk",
  "firstName":       "Saman",
  "lastName":        "Silva",
  "role":            "leader",
  "roles":           ["member", "leader"],
  "status":          "approved",
  "profilePhotoUrl": null,
  "phoneNumber":     null,
  "preferredLanguage": "en",
  "createdAt":       "2026-05-19T08:00:00.000Z",
  "updatedAt":       "2026-05-19T08:00:00.000Z",
  "deletedAt":       null
}
```

**Welcome email received by the new user (`leader` / `g12` path):**

| Field | Value |
|-------|-------|
| Subject | `Your Cell Leader Account has been Created — TCCR` or `Your G12 Leader Account has been Created — TCCR` |
| Credentials table | Email + temporary password |
| Reset button | `"Set Your Password →"` — Firebase one-time reset link (1 hr TTL) |
| Fallback (no reset link) | Prompt to change via *My Profile → Change Password* |
| System URL | Configured via `APP_URL` env var (default `https://cms.bethelnet.au/login`) |

**`409 Conflict`** — Email already registered
```json
{ "error": { "code": "EMAIL_EXISTS", "message": "Email address already registered." }, "requestId": "..." }
```

**`400 Bad Request`** — Validation failure (wrong role, missing field, password too short)
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." }, "requestId": "..." }
```

**`403 Forbidden`** — Caller is not `g12`, `admin`, or `super_admin`
```json
{ "error": { "code": "FORBIDDEN", "message": "Insufficient permissions." }, "requestId": "..." }
```

---

### 4.8 `POST /users/:uid/promote` — NEW V2

Promote an **already-registered** user to `leader` or `g12`. Unlike `POST /users` (section 4.7), this endpoint targets an existing user rather than creating a new account. Promotes the Firebase custom claims and Firestore `roles[]` array atomically.

> **Use `POST /users` (4.7) to create a brand-new account.
> Use `POST /users/:uid/promote` (4.8) to elevate an existing member.**

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**Caller-role business rules (enforced in use case, beyond the route guard):**

| Caller | Can promote to |
|--------|----------------|
| `g12`, `admin`, `super_admin` | `leader` or `g12` |
| `leader` | `g12` only (cannot create more leaders) |
| Any | Cannot target a user who holds `admin` or `super_admin` |

**Idempotent** — if the target already holds the requested role, returns `204` without re-writing.

#### Request Body

```json
{ "role": "leader" }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `role` | string | Yes | `"leader"` or `"g12"` only |

#### Responses

**`204 No Content`** — Role promoted successfully.

**`404 Not Found`** → `USER_NOT_FOUND`

**`403 Forbidden`** → `FORBIDDEN` — caller lacks permission to grant this role
```json
{ "error": { "code": "FORBIDDEN", "message": "..." }, "requestId": "..." }
```

---

### 4.9 `DELETE /users/:uid` ★ NEW 

Soft-delete a regular (non-admin) user account. Sets `deletedAt` in Firestore and disables the Firebase Auth account so the user can no longer sign in. The record is preserved for audit purposes.

> **For admin/super_admin accounts** use `DELETE /super-admin/admins/:uid` (section 18).

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Business rules — enforced by `DeleteUserUseCase`:**

| Condition | Result |
|-----------|--------|
| `targetUid === callerUid` | `403 FORBIDDEN` — cannot delete yourself |
| Target not found (or already deleted) | `404 USER_NOT_FOUND` |
| Target holds `admin` or `super_admin` role | `403 FORBIDDEN` — use `/super-admin/admins/:uid` |
| Target is a `member`, `student`, `leader`, or `g12` | `204 No Content` — deleted |

**Side effects (both execute; if `disableUser` fails the Firestore soft-delete has already committed):**
1. `userRepo.softDelete(uid)` — sets `deletedAt` + `updatedAt` in Firestore
2. `authClient.disableUser(uid)` — prevents future Firebase sign-ins

#### Responses

**`204 No Content`** — User deleted successfully. Empty response body.

**`403 Forbidden`** → `FORBIDDEN`

```json
{ "error": { "code": "FORBIDDEN", "message": "You cannot delete your own account." }, "requestId": "..." }
```

```json
{ "error": { "code": "FORBIDDEN", "message": "Admin accounts cannot be deleted through this endpoint. Use DELETE /super-admin/admins/:uid." }, "requestId": "..." }
```

**`404 Not Found`** → `USER_NOT_FOUND`

```json
{ "error": { "code": "USER_NOT_FOUND", "message": "User not found." }, "requestId": "..." }
```

---

### 4.10 `POST /users/:uid/demote` ★ NEW

Remove a specific role from a user and revert them to their remaining roles. Firebase Auth custom claims are updated immediately — the user's access changes on their next token refresh.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

#### Request Body

```json
{ "role": "leader" }
```

| Field | Type | Required | Values |
|-------|------|:--------:|--------|
| `role` | string | Yes | `"student"` \| `"leader"` \| `"g12"` |

#### Caller-Role Permission Matrix

| Caller | Can demote |
|--------|-----------|
| `super_admin` | `student`, `leader`, `g12` |
| `admin` | `student`, `leader`, `g12` |
| `g12` | `leader` only — **cannot demote another `g12`** |
| `leader` | `g12` only |

**Additional guards enforced in use case:**
- Cannot demote yourself
- Cannot demote an `admin` or `super_admin` via this endpoint
- `member` role can never be removed (permanent base role)
- Idempotent — returns `204` silently if the user does not already hold the role

#### What changes after a successful demote

| Before | After (example: remove `leader`) | Access |
|--------|-------------------------------------|--------|
| `roles: ["member","leader"]` | `roles: ["member"]` | Member access only |
| `roles: ["member","student","leader"]` | `roles: ["member","student"]` | Student access |
| `roles: ["member","g12"]` | `roles: ["member"]` | Member access only |

> **Token refresh required:** The user must sign out and sign in again (or call `user.getIdToken(true)`) to receive a new token with the updated roles claim. Existing tokens remain valid until they expire (1 hour).

#### Responses

**`204 No Content`** — Role removed; access updated.

**`400 Bad Request`** → `VALIDATION_ERROR` — Invalid role value
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "role: Invalid enum value" }, "requestId": "..." }
```

**`403 Forbidden`** → `FORBIDDEN`
```json
{ "error": { "code": "FORBIDDEN", "message": "Your role does not permit you to remove the 'leader' role." }, "requestId": "..." }
```

**`404 Not Found`** → `USER_NOT_FOUND`

---
## 5. Role Requests — NEW V2

After registration every user is a **Member**. From there they can follow two paths — both require Admin/Super Admin approval:

```
              MEMBER (auto on register)
             ↙                        ↘
          apply                      apply
            ↓                          ↓
     Bible School               Cell Group
  (POST /role-requests)   (POST /cells/:id/join-requests)
  Admin/Super Admin approves    Admin/Super Admin approves
            ↓                          ↓
    roles: ["member","student"]   Added to cell group
    Can now enroll in courses     Can view cell (read-only)
```

The Bible School path is **two separate steps**:

**Step 1 — Get Student role** (this section): Member submits a role request with their personal details and education qualification PDF. Admin/Super Admin reviews and approves → member gains `student` role.

**Step 2 — Enroll in a course** (Section 11): Student selects a course + batch and submits an enrollment request. Admin/Super Admin approves → student can access course content.

> `POST /role-requests` grants only the **student role**. Course enrollment is handled separately under [Enrollment Endpoints](#11-enrollment-endpoints). Cell group joining is handled separately under [Cell Group Endpoints](#13-cell-group-endpoints--new-v2).

---

### 5.1 `POST /role-requests`

Member submits an application for the `student` role. Personal details and qualification PDF are read automatically from the member's existing profile — no extra fields needed in the request body.

> **Before submitting**, the member must have completed their profile via `PATCH /me` (§3.2) and uploaded their qualification PDF via `POST /me/qualification` (§3.5). The system snapshots the profile at submission time.

**Authentication:** Bearer required | **Roles:** `member`
**Content-Type:** `application/json`

#### Request Body

```json
{ "requestedRole": "student" }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `requestedRole` | string | Yes | `"student"` only |

#### Responses

**`201 Created`**
```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "pending",
  "applicantProfile": {
    "firstName":          "John",
    "lastName":           "Doe",
    "phoneNumber":        "+94771234567",
    "email":              "john@example.com",
    "dateOfBirth":        "2000-06-15",
    "gender":             "male",
    "address":            "123 Main St, Colombo",
    "qualificationTitle": "BSc Computer Science",
    "qualificationUrl":   "https://firebasestorage.googleapis.com/v0/b/bucket/o/qualifications%2Fuid.pdf?alt=media&token=..."
  },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": null,
  "decidedByUid":  null,
  "decisionNote":  null,
  "createdAt":     "2026-05-22T09:00:00.000Z",
  "decidedAt":     null
}
```

**`400 Bad Request`** → `VALIDATION_ERROR` — invalid or missing `requestedRole`
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "requestedRole: Invalid literal value, expected \"student\"" }, "requestId": "..." }
```

**`404 Not Found`** → `USER_NOT_FOUND` — profile could not be loaded from user-service
```json
{ "error": { "code": "USER_NOT_FOUND", "message": "Could not load your profile. Please try again." }, "requestId": "..." }
```

**`409 Conflict`** → `ROLE_REQUEST_PENDING` — a pending request already exists
```json
{ "error": { "code": "ROLE_REQUEST_PENDING", "message": "You already have a pending role request." }, "requestId": "..." }
```

---

### 5.2 `GET /role-requests/mine`

List own role requests (FR-MEM-004).

**Authentication:** Bearer required | **Roles:** Any authenticated

> **Response shape:** Returns a **plain array** (not paginated). `GetMyRoleRequestsUseCase` fetches all requests for the caller and returns them directly via `sendSuccess()`.

**`200 OK`**
```json
[
  {
    "id":            "req-001",
    "requesterUid":  "Xf3aBC...",
    "requestedRole": "student",
    "status":        "pending",
    "applicantProfile": {
      "firstName":   "John",
      "lastName":    "Doe",
      "phoneNumber": "+94771234567",
      "email":       "john@example.com",
      "dateOfBirth": "2000-06-15",
      "gender":      "male",
      "address":     "123 Main St, Colombo"
    },
    "qualificationTitle":       "BSc Computer Science",
    "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
    "decidedByUid":  null,
    "decisionNote":  null,
    "createdAt":     "2026-05-22T09:00:00.000Z",
    "decidedAt":     null
  }
]
```

---

### 5.3 `GET /role-requests`

List all requests in the admin review queue.

**Authentication:** Bearer required | **Roles:** `admin`

| Parameter | Description |
|-----------|-------------|
| `status` | `pending` \| `approved` \| `rejected` |
| `limit`, `cursor` | Pagination |

**`200 OK`** — Paginated RoleRequest list. Each item includes the full `applicantProfile` object, `qualificationTitle`, and `qualificationStoragePath`.

---

### 5.4 `GET /role-requests/:id` ★ Updated

Get a single role request including full applicant details. For `admin` / `super_admin` callers, the response also includes a **`memberProfile`** block with the member's **current live profile** fetched from user-service — giving the reviewer up-to-date information before approving or rejecting.

**Authentication:** Bearer required | **Roles:** Any authenticated (`member`, `student`, `leader`, `g12`, `admin`, `super_admin`)

**Ownership rule** — enforced by `GetRoleRequestByIdUseCase`:

| Caller | Access | `memberProfile` |
|--------|--------|----------------|
| `admin` / `super_admin` | May fetch **any** role request | ✅ Included (live from user-service) |
| All other roles | May only fetch requests where `roleRequest.requesterUid === caller UID` → `403` otherwise | `null` |

#### Responses

**`200 OK` (admin / super_admin)** — Full `RoleRequestDetail` object with live `memberProfile`:

```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "pending",
  "applicantProfile": {
    "firstName":          "John",
    "lastName":           "Doe",
    "phoneNumber":        "+94771234567",
    "email":              "john@example.com",
    "dateOfBirth":        "2000-06-15",
    "gender":             "male",
    "address":            "123 Main St, Colombo",
    "qualificationTitle": "BSc Computer Science",
    "qualificationUrl":   "https://firebasestorage.googleapis.com/..."
  },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
  "decidedByUid":  null,
  "decisionNote":  null,
  "createdAt":     "2026-05-22T09:00:00.000Z",
  "decidedAt":     null,
  "memberProfile": {
    "uid":               "Xf3aBC...",
    "email":             "john@example.com",
    "firstName":         "John",
    "lastName":          "Doe",
    "phoneNumber":       "+94771234567",
    "profilePhotoUrl":   "https://firebasestorage.googleapis.com/.../avatars/Xf3aBC....jpg",
    "dateOfBirth":       "2000-06-15",
    "gender":            "male",
    "address":           "123 Main St, Colombo",
    "preferredLanguage": "en",
    "roles":             ["member"],
    "status":            "approved",
    "accountCreatedAt":  "2026-04-10T07:30:00.000Z",
    "qualifications": [
      {
        "id":      "qual-001",
        "title":   "BSc Computer Science",
        "fileUrl": "https://firebasestorage.googleapis.com/..."
      }
    ]
  }
}
```

**`200 OK` (non-admin — own request only)** — Same shape but `memberProfile` is `null`:

```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "pending",
  "applicantProfile": { "..." : "..." },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
  "decidedByUid": null,
  "decisionNote": null,
  "createdAt":    "2026-05-22T09:00:00.000Z",
  "decidedAt":    null,
  "memberProfile": null
}
```

> **Note:** `memberProfile` data is fetched live from user-service on every admin request — it always reflects the member's current profile, unlike `applicantProfile` which is a snapshot taken at submission time. If user-service is temporarily unavailable, `memberProfile` degrades to `null` (the role request data is still returned).

**`403 Forbidden`** → `FORBIDDEN` — non-admin caller tried to view another user's request

```json
{ "error": { "code": "FORBIDDEN", "message": "You can only view your own role requests." }, "requestId": "..." }
```

**`404 Not Found`** → `ROLE_REQUEST_NOT_FOUND`

```json
{ "error": { "code": "ROLE_REQUEST_NOT_FOUND", "message": "Role request not found." }, "requestId": "..." }
```

---

### 5.5 `GET /role-requests/:id/qualification` ★ NEW

Generate a **15-minute signed URL** for the applicant's qualification PDF. The file is never publicly accessible — every download requires a fresh signed URL from this endpoint.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**`200 OK`**
```json
{
  "signedUrl":          "https://storage.googleapis.com/bucket/qualifications/...?X-Goog-Signature=...",
  "expiresAt":          "2026-05-22T10:15:00.000Z",
  "qualificationTitle": "BSc Computer Science"
}
```

> The signed URL expires after **15 minutes**. Re-call this endpoint to get a fresh URL if needed.

**`404 Not Found`** → `ROLE_REQUEST_NOT_FOUND`

---

### 5.6 `POST /role-requests/:id/approve`

Grants the requested role — adds `student` to `roles[]` and updates Firebase custom claims atomically. **Does not create a course enrollment** — the student must separately apply for a course batch via `POST /enrollments`.

**Authentication:** Bearer required | **Roles:** `admin`

> Admin cannot approve their own requests (FR-ADM-008).

```json
{ "note": "Welcome! You can now browse and apply for courses." }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `note` | string | No | 1–500 chars — shown in the approval email sent to the student |

#### Side Effects (on `200`)

| Step | Detail |
|------|--------|
| 1 | `student` role added to user's `roles[]` in Firestore and Firebase Auth custom claims (dual-write) |
| 2 | `role.granted` event published to the outbox |
| 3 | Outbox-worker dispatches (~5 s) → **`RoleGrantedHandler`** runs: |
|   | &nbsp;&nbsp;• In-app notification to the student: *"Student Role Approved"* |
|   | &nbsp;&nbsp;• **Approval email** sent to the student's registered address (see below) |
|   | &nbsp;&nbsp;• Audit log entry written |
| 4 | Student enrichment is fire-and-forget — if user-service is unavailable, role grant still proceeds and email fields fall back to `undefined` |

#### Approval Email

| Field | Value |
|-------|-------|
| **To** | Student's registered email address |
| **Subject** | `Your Student Application has been Approved — TCCR` |
| **Greeting** | `Hi <firstName> <lastName>,` |
| **Role table** | Role Granted: **Student ✓** (green) |
| **Admin note** | Blue left-border callout showing the `note` field (omitted if blank) |
| **Next steps** | Browse courses → Submit enrollment requests → Track progress |
| **Login button** | `Log in to TCCR →` — links to `APP_URL` (default `https://cms.bethelnet.au/login`) |

> Role labels: `student` → "Student", `leader` → "Cell Leader", `g12` → "G12 Leader"  
> Email delivery is retried 3× with 1 s → 2 s → 4 s backoff. Failure is logged but never surfaces — `200` is always returned if the role grant succeeds.

**`200 OK`** — Updated `RoleRequest` entity with `status: "approved"`:

```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "approved",
  "decidedByUid":  "admin-uid",
  "decisionNote":  "Welcome! You can now browse and apply for courses.",
  "applicantProfile": {
    "firstName":   "John",
    "lastName":    "Doe",
    "phoneNumber": "+94771234567",
    "email":       "john@example.com",
    "dateOfBirth": "2000-06-15",
    "gender":      "male",
    "address":     "123 Main St, Colombo"
  },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
  "createdAt":     "2026-05-22T09:00:00.000Z",
  "decidedAt":     "2026-05-22T10:05:00.000Z"
}
```

**`404 Not Found`** → `ROLE_REQUEST_NOT_FOUND`

**`409 Conflict`** → `INVALID_STATE` — request is already approved or rejected

---

### 5.7 `POST /role-requests/:id/reject`

Rejects the role application (FR-ENR-005).

**Authentication:** Bearer required | **Roles:** `admin`

```json
{ "note": "Batch is full. Please apply for the next intake." }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `note` | string | No | 1–500 chars |

#### Side Effects (on `200`)

| Step | Detail |
|------|--------|
| 1 | `role.rejected` event published to the outbox |
| 2 | Outbox-worker dispatches — event is **not currently wired** in EventDispatcher; silently skipped. No email or in-app notification is sent to the student at this time. |

**`200 OK`** — Updated `RoleRequest` entity with `status: "rejected"`:

```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "rejected",
  "decidedByUid":  "admin-uid",
  "decisionNote":  "Batch is full. Please apply for the next intake.",
  "applicantProfile": {
    "firstName":   "John",
    "lastName":    "Doe",
    "phoneNumber": "+94771234567",
    "email":       "john@example.com",
    "dateOfBirth": "2000-06-15",
    "gender":      "male",
    "address":     "123 Main St, Colombo"
  },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
  "createdAt":     "2026-05-22T09:00:00.000Z",
  "decidedAt":     "2026-05-22T10:05:00.000Z"
}
```

**`404 Not Found`** → `ROLE_REQUEST_NOT_FOUND`

**`409 Conflict`** → `INVALID_STATE` — request is already approved or rejected

---

## 6. Course Endpoints

---

### 6.1 `GET /courses`

List courses. Member/Student/public see `published` only. Admin sees all states.

**Authentication:** Optional | **Roles:** All

| Parameter | Description |
|-----------|-------------|
| `title` | Case-sensitive prefix search on course title |
| `state` | `draft` \| `published` \| `archived` (admin only) |
| `limit`, `cursor` | Pagination |

**`200 OK`**
```json
{
  "items": [{
    "id": "course-abc", "title": "Bible Foundations",
    "description": "An introduction to the Bible.",
    "coverImageUrl": null, "state": "published",
    "semesterCount": 3, "batchCount": 2,
    "createdAt": "2026-01-01T08:00:00.000Z",
    "updatedAt": "2026-05-01T09:00:00.000Z"
  }],
  "nextCursor": null, "total": 5
}
```

---

### 6.2 `GET /courses/:id`

Get course with semester and subject tree. Student/public get `404` if draft or archived.

**Authentication:** Optional | **Roles:** All

**`200 OK`**
```json
{
  "id": "course-abc", "title": "Bible Foundations",
  "description": "An introduction to the Bible.",
  "coverImageUrl": null, "state": "published",
  "semesterCount": 2, "batchCount": 2,
  "createdAt": "2026-01-01T08:00:00.000Z",
  "updatedAt": "2026-05-01T09:00:00.000Z",
  "semesters": [{
    "id": "sem-001", "title": "Semester 1 — Foundations",
    "number": 1, "openDate": "2026-07-01", "endDate": "2026-09-30",
    "status": "active",
    "subjects": [{ "id": "sub-001", "title": "The Gospel of John", "order": 1 }]
  }]
}
```

**`404`** → `COURSE_NOT_FOUND`

---

### 6.3 `POST /courses`

Create a course in `draft` state. `title` must be unique.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

```json
{ "title": "Bible Foundations", "description": "...", "coverImageUrl": null }
```

**`201 Created`** — Course object. | **`409`** → `COURSE_TITLE_EXISTS`

---

### 6.4 `PATCH /courses/:id`

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Updated Course object.

---

### 6.5 `POST /courses/:id/publish`

Publish a `draft` course. Requires: ≥1 Batch, ≥1 Semester, every semester has ≥1 Subject.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Course with `status: "published"`.

**`409`** → `INVALID_STATE` | **`422`** → `NO_SEMESTERS` / `EMPTY_SEMESTER`

---

### 6.6 `POST /courses/:id/unpublish`

Return to `draft`. Enrolled students retain enrollments; content suspended until re-published.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Course with `status: "draft"`.

---

### 6.7 `POST /courses/:id/archive`

Archive a published course. Cannot archive if active enrollments exist (FR-CRS-008).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Course with `status: "archived"`.

**`409 Conflict`**
```json
{ "error": { "code": "INVALID_STATE", "message": "Cannot archive a course with active enrollments. Withdraw all enrollments first." }, "requestId": "..." }
```

---

### 6.8 `POST /courses/:id/restore`

Restore an `archived` course back to `draft`. The course must be re-published before it is visible to students again.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Course object with `state: "draft"` (full semester/subject tree intact)

**`404 Not Found`** — Course does not exist

**`409 Conflict`** → `INVALID_STATE`
```json
{ "error": { "code": "INVALID_STATE", "message": "Only an ARCHIVED course can be restored." }, "requestId": "..." }
```

---

### 6.9 `DELETE /courses/:id`

Soft-delete. Sets `deletedAt`; recoverable 30 days.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`204 No Content`**

---

## 7. Batch Endpoints — NEW V2

Batches are intake cohorts. They carry **no curriculum** — all batches of a course share the same Semesters/Subjects/Lessons (SRS §8.2.2).

---

### 7.1 `GET /courses/:id/batches`

**Authentication:** Bearer required | **Roles:** Any authenticated

| Parameter | Description |
|-----------|-------------|
| `state` | `draft` \| `open` \| `closed` |
| `limit`, `cursor` | Pagination |

**`200 OK`**
```json
{
  "items": [{
    "id":               "batch-xyz",
    "courseId":         "course-abc",
    "name":             "2026 Intake 01",
    "scheduledOpenAt":  "2026-06-01T08:00:00.000Z",
    "intakeStart":      "2026-06-01",
    "intakeEnd":        "2026-06-30",
    "capacity":         50,
    "state":            "open",
    "createdAt":        "2026-05-01T00:00:00.000Z",
    "updatedAt":        "2026-05-01T00:00:00.000Z"
  }],
  "nextCursor": null, "total": 2
}
```

---

### 7.2 `POST /courses/:id/batches`

Create a batch (FR-CRS-002).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

```json
{
  "name":            "2026 Intake 01",
  "scheduledOpenAt": "2026-06-01T08:00:00.000Z",
  "intakeStart":     "2026-06-01",
  "intakeEnd":       "2026-06-30",
  "capacity":        50
}
```

| Field | Required | Notes |
|-------|:--------:|-------|
| `name` | Yes | Unique within course |
| `scheduledOpenAt` | No | ISO datetime — batch **auto-opens** at this time (Scheduled Jobs trigger). If omitted, admin must open manually via `POST /batches/:id/open`. |
| `intakeStart` | Yes | ISO date — earliest date students can submit enrollment |
| `intakeEnd` | Yes | ISO date — must be after `intakeStart`; enrollment window **auto-closes** when this passes |
| `capacity` | No | Optional max student cap |

> **Auto-scheduling:** When `scheduledOpenAt` is set, the Scheduled Jobs service polls every 15 minutes and flips `state` from `draft` → `open` at the scheduled time. When `intakeEnd` passes, the same job flips `state` from `open` → `closed` automatically.

**`201 Created`** — Batch object.

---

### 7.3 `GET /batches/:id`

**Authentication:** Bearer required | **Roles:** Any authenticated

**`200 OK`** — Batch object. | **`404`** → `BATCH_NOT_FOUND`

---

### 7.4 `PATCH /batches/:id`

Cannot change dates if approved enrollments exist.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Updated Batch object.

---

### 7.5 `POST /batches/:id/open`

Manually open a batch for enrollment before or instead of the `scheduledOpenAt` time. Batch must be in `draft` state.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Batch with `state: "open"`.

**`409 Conflict`** — Batch is not in `draft` state
```json
{ "error": { "code": "INVALID_STATE", "message": "Only a DRAFT batch can be opened." }, "requestId": "..." }
```

---

### 7.6 `POST /batches/:id/close`

Manually close intake window before `intakeEnd` is reached. No new enrollment requests will be accepted after closing.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Batch with `state: "closed"`.

**`409 Conflict`** — Batch is not in `open` state
```json
{ "error": { "code": "INVALID_STATE", "message": "Only an OPEN batch can be closed." }, "requestId": "..." }
```

---

## 8. Semester Endpoints

V1 carry-forward. V2 adds `openDate` and `endDate` (FR-CRS-003).

> **SRS §8.2.3:** Semesters are a sub-collection of **courses**, not batches. `GET /batches/:id/semesters` is an alias that returns the parent course's semesters.

---

### 8.1 `GET /courses/:id/semesters`

**Authentication:** Bearer required | **Roles:** Any authenticated

**`200 OK`**
```json
{
  "items": [{
    "id": "sem-001", "courseId": "course-abc",
    "title": "Semester 1 — Foundations", "number": 1,
    "openDate": "2026-07-01", "endDate": "2026-09-30",
    "status": "active", "subjectCount": 4,
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-01T08:00:00.000Z"
  }],
  "nextCursor": null, "total": 3
}
```

---

### 8.2 `POST /courses/:id/semesters` — Amended V2

V2 adds `openDate` and `endDate`. After `endDate` the semester is auto-disabled by the nightly sweep job (FR-CRS-004).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

```json
{ "title": "Semester 1 — Foundations", "number": 1, "openDate": "2026-07-01", "endDate": "2026-09-30" }
```

| Field | Required | Notes |
|-------|:--------:|-------|
| `title` | Yes | 1–200 chars |
| `number` | Yes | Sequence within course |
| `openDate` | Yes | ISO date; when content becomes accessible |
| `endDate` | No | ISO date; auto-disables after this date |

**`201 Created`** — Semester object.

---

### 8.3 `PATCH /semesters/:id`

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Updated Semester object.

---

### 8.4 `DELETE /semesters/:id`

Soft-delete a semester and all its subjects.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`204 No Content`**

---

## 9. Subject & Lesson Endpoints

---

### 9.1 `GET /semesters/:id/subjects`

List active subjects. Student must have approved enrollment in the parent course.

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`, `admin`, `super_admin`

**`403`** → `SEMESTER_DISABLED` (FR-STU-005 — semester's endDate passed)

**`200 OK`**
```json
[{
  "id": "sub-001", "semesterId": "sem-001", "courseId": "course-abc",
  "title": "The Gospel of John", "description": "Deep study of John's Gospel.",
  "order": 1,
  "imageUrls": ["https://storage.googleapis.com/.../cover.jpg"],
  "attachments": [{ "id": "att-001", "filename": "study-notes.pdf", "mimeType": "application/pdf", "sizeBytes": 204800 }],
  "deletedAt": null,
  "createdAt": "2026-05-01T09:00:00.000Z",
  "updatedAt": "2026-05-01T09:00:00.000Z"
}]
```

---

### 9.2 `POST /semesters/:id/subjects` — Amended V2

V2 adds `imageUrls[]` for PNG/JPG cover images (FR-CRS-005).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

```json
{ "title": "The Gospel of John", "description": "...", "imageUrls": [], "attachments": [], "lessons": [] }
```

**`201 Created`** — Subject object.

---

### 9.3 `PATCH /subjects/:id`

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Updated Subject object.

---

### 9.4 `DELETE /subjects/:id`

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`204 No Content`**

---

### 9.5 `GET /subjects/:id/lessons`

Plain array of Lesson objects, ordered by `order` ascending (FR-LRN-001).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12` (enrolled), `admin`, `super_admin`

**`200 OK`**
```json
[{
  "id": "lesson-001", "subjectId": "sub-001", "courseId": "course-abc", "semesterId": "sem-001",
  "title": "Introduction to John's Gospel",
  "description": "Overview of the fourth Gospel.",
  "youtubeVideoId": "dQw4w9WgXcQ",
  "attachmentIds": ["att-001"],
  "order": 1, "deletedAt": null,
  "createdAt": "2026-05-12T09:00:00.000Z",
  "updatedAt": "2026-05-12T09:00:00.000Z"
}]
```

---

### 9.6 `POST /subjects/:id/lessons`

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

```json
{
  "title": "Introduction to John's Gospel",
  "description": "Overview of the fourth Gospel.",
  "youtubeVideoId": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "attachmentIds": []
}
```

| Field | Required | Validation |
|-------|:--------:|-----------|
| `title` | Yes | 1–200 chars |
| `description` | No | Max 2000 chars |
| `youtubeVideoId` | No | Valid YouTube URL; 11-char ID extracted and stored. Pass `null` to clear. |
| `attachmentIds` | No | Array of existing Attachment IDs |

**`201 Created`** — Lesson object.

---

### 9.7 `PATCH /lessons/:id`

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** — Updated Lesson object.

---

### 9.8 `DELETE /lessons/:id`

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`204 No Content`**

---

## 10. Attachment & Image Endpoints

---

### 10.1 `POST /subjects/:id/attachments`

Upload PDF or DOCX. Max **25 MB** (FR-CRS-010).

**Authentication:** Bearer required | **Roles:** `admin`
**Content-Type:** `multipart/form-data`

| Field | Allowed MIME | Max |
|-------|-------------|:---:|
| `file` | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 25 MB |

**`201 Created`**
```json
{
  "id": "att-001", "subjectId": "sub-001", "courseId": "course-abc",
  "filename": "study-notes.pdf", "mimeType": "application/pdf",
  "sizeBytes": 204800,
  "storagePath": "subjects/sub-001/attachments/att-001.pdf",
  "createdAt": "2026-05-02T10:00:00.000Z"
}
```

**`415`** → `UNSUPPORTED_MEDIA_TYPE` | **`400`** → `FILE_TOO_LARGE`

---

### 10.2 `POST /subjects/:id/images` — NEW V2

Upload PNG or JPG cover image (FR-CRS-005). Max **10 MB**.

**Authentication:** Bearer required | **Roles:** `admin`
**Content-Type:** `multipart/form-data`

| Field | Allowed MIME | Max |
|-------|-------------|:---:|
| `file` | `image/png`, `image/jpeg` | 10 MB |

**`201 Created`**
```json
{
  "id": "img-001", "subjectId": "sub-001",
  "url": "https://storage.googleapis.com/.../cover.jpg",
  "mimeType": "image/jpeg", "sizeBytes": 512000,
  "createdAt": "2026-05-02T10:05:00.000Z"
}
```

---

### 10.3 `GET /attachments/:id/download-url`

Short-lived signed URL. Expires in **15 minutes** (FR-LRN-002). Student must have approved enrollment.

**Authentication:** Bearer required | **Roles:** `student` (enrolled), `admin`+

**`200 OK`**
```json
{ "downloadUrl": "https://storage.googleapis.com/...?X-Goog-Signature=...", "expiresAt": "2026-05-15T11:00:00.000Z" }
```

**`403`** → `FORBIDDEN` (not enrolled) | **`404`** → `ATTACHMENT_NOT_FOUND`

---

### 10.4 `DELETE /attachments/:id`

Remove attachment or image from Cloud Storage and subject record.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`204 No Content`**

---

## 11. Enrollment Endpoints

---

### 11.1 `GET /enrollments/mine`

List own enrollments (SRS §7.3.5 path).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**`200 OK`**
```json
{
  "items": [{
    "id": "Xf3aBC..._batch-xyz",
    "userUid": "Xf3aBC...",
    "courseId": "course-abc", "courseName": "Bible Foundations",
    "batchId": "batch-xyz",  "batchName": "2026 Intake",
    "status": "approved",
    "enrolledAt": "2026-05-10T09:00:00.000Z",
    "createdAt": "2026-05-08T12:00:00.000Z",
    "updatedAt": "2026-05-10T09:00:00.000Z"
  }],
  "nextCursor": null, "total": 1
}
```

---

### 11.2 `POST /enrollments`

**Already-Student path:** enroll in an additional course (FR-STU-004). No role grant needed.

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

```json
{ "courseId": "course-def", "batchId": "batch-456" }
```

**`201 Created`** — Enrollment with `status: "pending"`.

**`409`** → `ALREADY_ENROLLED` | **`422`** → `COOLOFF_ACTIVE`

---

### 11.3 `POST /enrollments/:id/withdraw`

**Authentication:** Bearer required | **Roles:** `student` (own only)

**`200 OK`** — Enrollment with `status: "withdrawn"`.

**`403`** → `FORBIDDEN` (not owner) | **`409`** → `INVALID_STATE`

---

### 11.4 `GET /enrollments`

Admin view.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `userId` | Filter by user UID |
| `courseId` | Filter by course |
| `batchId` | Filter by batch — **NEW V2** |
| `status` | `pending` \| `approved` \| `withdrawn` \| `rejected` |
| `search` | Partial match on user name/email |
| `limit`, `cursor` | Pagination |

**`200 OK`** — Paginated Enrollment list.

---

### 11.5 `POST /enrollments/:id/approve`

Approve an enrollment. Sets `state: "approved"` on the enrollment and dispatches a **welcome email** to the student (FR-ENR-005).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`  
**Content-Type:** `application/json`

#### Request Body

```json
{ "note": "Congratulations! Your enrollment has been approved for the 2026 intake." }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `note` | string | No | 1–500 chars — shown in the approval email sent to the student |

#### Side Effects (on `200`)

| Step | Detail |
|------|--------|
| 1 | Enrollment `state` → `approved`, `approvedAt` timestamp set |
| 2 | `enrollment.approved` event published to the outbox |
| 3 | Outbox-worker dispatches (~5 s) → **`EnrollmentApprovedHandler`** runs: |
|   | &nbsp;&nbsp;• In-app notification to the student: *"Enrollment Approved"* |
|   | &nbsp;&nbsp;• **Approval email** sent to the student's registered address (see below) |
|   | &nbsp;&nbsp;• Push notification to student's FCM token (if registered; best-effort) |

#### Approval Email

| Field | Value |
|-------|-------|
| **To** | Student's registered email address |
| **Subject** | `Enrollment Approved — <Course Title> — TCCR` |
| **Greeting** | `Hi <firstName> <lastName>,` |
| **Course table** | Course name + Status: **Approved ✓** |
| **Admin note** | Highlighted callout block showing the `note` field (omitted if blank) |
| **Body** | Instruction to log in and access the course from *My Enrollments* |
| **Login button** | `Log in to TCCR →` — links to `APP_URL` (default `https://cms.bethelnet.au/login`) |

> **Email delivery:** Retried 3× with 1 s → 2 s → 4 s backoff. Failure is logged but never surfaces — `200` is returned if the state transition succeeds.

#### Response

**`200 OK`** — Enrollment object with `state: "approved"`.

```json
{
  "id": "Xf3aBC..._course-abc",
  "studentUid": "Xf3aBC...",
  "courseId": "course-abc",
  "state": "approved",
  "approvedAt": "2026-05-22T10:00:00.000Z",
  "reason": null,
  "createdAt": "2026-05-20T09:00:00.000Z",
  "updatedAt": "2026-05-22T10:00:00.000Z"
}
```

**`404 Not Found`** → `ENROLLMENT_NOT_FOUND`

**`409 Conflict`** → `INVALID_STATE` — enrollment is not in `pending` state

---

### 11.6 `POST /enrollments/:id/reject`

Reject an enrollment application and send a **rejection notification email** to the student.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`  
**Content-Type:** `application/json`

#### Request Body

```json
{ "reason": "We have reached the maximum capacity for this intake. Please apply for the next available batch." }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `reason` | string | No | 1–500 chars — shown in the rejection email; if omitted the email states no reason was provided |

#### Side Effects (on `200`)

| Step | Detail |
|------|--------|
| 1 | Enrollment `state` → `rejected`, `rejectedAt` timestamp set, `reason` stored |
| 2 | `enrollment.rejected` event published to the outbox |
| 3 | Outbox-worker dispatches (~5 s) → **`EnrollmentRejectedHandler`** runs: |
|   | &nbsp;&nbsp;• In-app notification to the student: *"Enrollment Not Approved"* |
|   | &nbsp;&nbsp;• **Rejection email** sent to the student's registered address (see below) |

#### Rejection Email

| Field | Value |
|-------|-------|
| **To** | Student's registered email address |
| **Subject** | `Enrollment Update — <Course Title> — TCCR` |
| **Greeting** | `Hi <firstName> <lastName>,` |
| **Course table** | Course name + Status: **Not Approved** (red) |
| **Reason block** | Red left-border callout showing the `reason` (shows "No specific reason provided" when blank) |
| **Body** | Encouragement to contact admin or reapply in a future intake |
| **Login button** | `Log in to TCCR →` — links to `APP_URL` (default `https://cms.bethelnet.au/login`) |

#### Response

**`200 OK`** — Enrollment object with `state: "rejected"`.

```json
{
  "id": "Xf3aBC..._course-abc",
  "studentUid": "Xf3aBC...",
  "courseId": "course-abc",
  "state": "rejected",
  "reason": "Batch capacity reached.",
  "rejectedAt": "2026-05-22T10:00:00.000Z",
  "approvedAt": null,
  "createdAt": "2026-05-20T09:00:00.000Z",
  "updatedAt": "2026-05-22T10:00:00.000Z"
}
```

**`404 Not Found`** → `ENROLLMENT_NOT_FOUND`

**`409 Conflict`** → `INVALID_STATE` — enrollment is not in `pending` state

---

## 12. Progress Endpoints

---

### 12.1 `POST /progress/subjects/:id/complete`

Mark subject complete. **Idempotent** — already-completed returns existing record unchanged (FR-LRN-003 / FR-STU-011).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

```json
{ "courseId": "course-abc", "semesterId": "sem-001" }
```

**`200 OK`**
```json
{
  "id": "Xf3aBC..._sub-001", "userUid": "Xf3aBC...",
  "subjectId": "sub-001", "courseId": "course-abc",
  "semesterId": "sem-001",
  "status": "completed",
  "completedAt": "2026-05-07T14:00:00.000Z",
  "lastAccessedAt": "2026-05-07T14:00:00.000Z"
}
```

**`403`** → `SEMESTER_DISABLED` (FR-STU-005)

---

### 12.2 `POST /progress/subjects/:id/access`

Update `lastAccessedAt`. Transitions `not_started` → `in_progress` on first access (FR-LRN-007).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

```json
{ "courseId": "course-abc", "semesterId": "sem-001" }
```

**`200 OK`** — SubjectProgress object.

---

### 12.3 `GET /me/progress/courses/:courseId`

Course-level progress aggregate (FR-LRN-004).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**`200 OK`**
```json
{
  "courseId": "course-abc", "batchId": "batch-xyz", "userUid": "Xf3aBC...",
  "completedCount": 4, "pendingCount": 6, "totalSubjects": 10,
  "completionPercent": 40.0, "lastAccessedSubjectId": "sub-003"
}
```

---

### 12.4 `GET /me/progress/subjects/:subjectId`

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**`200 OK`** — SubjectProgress object.

---

### 12.5 `GET /admin/progress/courses/:courseId`

Admin view. Supports `?batchId` to scope to one intake.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `batchId` | Filter to one intake — **NEW V2** |
| `limit`, `cursor` | Pagination |

**`200 OK`** — Paginated per-student progress aggregates.

---

## 13. Cell Group Endpoints — NEW V2

---

### 13.1 `GET /cells`

List cell groups. Scope auto-applied by role:
- **Member/Student** → sees all `active` cells only
- **Leader** → sees only cells they lead (`active` by default)
- **G12** → sees all cells in their network (`active` by default, can pass `?state=archived`)
- **Admin/Super Admin** → sees **ALL cells across ALL states** (active + archived) by default; can filter with `?state=active|archived` ★ Updated

**Authentication:** Bearer required | **Roles:** Any authenticated

| Parameter | Description |
|-----------|-------------|
| `search` | Partial match on cell name |
| `type` | `g12` \| `care` \| `children` \| `outreach` |
| `area` | Exact match on area |
| `state` | `active` \| `archived` — default varies by role: `admin`/`super_admin` see **all states** when omitted; all others default to `active` ★ Updated |
| `leaderUid` | Filter by leader (admin/g12 only) |
| `limit`, `cursor` | Pagination |

**`200 OK`**
```json
{
  "items": [{
    "id": "cell-001", "name": "Rathmalana West G12",
    "type": "g12", "area": "Rathmalana",
    "leaderUid": "usr-leader1", "leaderName": "Sithuru Kavinda",
    "g12LeaderUid": "usr-g12-1", "g12LeaderName": "Ushani Amanda",
    "memberCount": 8, "reportCount": 12,
    "state": "active", "createdAt": "2026-01-15T00:00:00.000Z",
    "updatedAt": "2026-05-14T00:00:00.000Z"
  }],
  "nextCursor": null, "total": 3
}
```

---

### 13.2 `GET /cells/mine`

Cells the signed-in user belongs to (FR-MEM-006 / FR-CG-005).

**Authentication:** Bearer required | **Roles:** Any authenticated

**`200 OK`** — Array of CellGroup summaries.

---

### 13.3 `POST /cells`

Create a cell group (FR-LDR-001).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

```json
{ "name": "Rathmalana West G12", "type": "g12", "area": "Rathmalana", "g12LeaderUid": "usr-g12-1" }
```

**`201 Created`** — CellGroup object.

---

### 13.4 `GET /cells/:id`

Fetch cell with full member roster (FR-CG-005).

**Authentication:** Bearer required | **Roles:** Member of cell, owning leader/G12, `admin`+

**`200 OK`**
```json
{
  "id": "cell-001", "name": "Rathmalana West G12",
  "type": "g12", "area": "Rathmalana",
  "leaderUid": "usr-leader1", "g12LeaderUid": "usr-g12-1",
  "members": [{ "uid": "usr-mem1", "firstName": "Sapna", "lastName": "Nethmini", "displayName": "Sapna Nethmini" }],
  "memberCount": 8, "reportCount": 12, "state": "active",
  "createdAt": "2026-01-15T00:00:00.000Z", "updatedAt": "2026-05-14T00:00:00.000Z"
}
```

**`404`** → `CELL_NOT_FOUND`

---

### 13.5 `PATCH /cells/:id`

**Authentication:** Bearer required | **Roles:** Owning leader/G12, `admin`+

```json
{ "name": "Rathmalana West Care", "type": "care", "area": "Rathmalana East" }
```

**`200 OK`** — Updated CellGroup.

---

### 13.6 `POST /cells/:id/archive`

**Authentication:** Bearer required | **Roles:** Owning leader/G12, `admin`+

**`200 OK`** — CellGroup with `state: "archived"`.

---

### 13.7 `DELETE /cells/:id` ★ NEW

Permanently delete a cell group. Only the cell's own leader, G12 leader, or an admin can delete it.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`  

**Ownership rule — enforced in `DeleteCellGroupUseCase`:**

| Caller | Can delete? |
|--------|------------|
| Cell's `leaderUid` (owner) | ✅ Yes |
| Cell's `g12LeaderUid` | ✅ Yes |
| `admin` / `super_admin` | ✅ Yes |
| Different leader (not the owner) | ❌ `403 FORBIDDEN` |
| `member` / `student` | ❌ `403 FORBIDDEN` |

**`204 No Content`** — Cell permanently deleted.

**`403 Forbidden`** → `FORBIDDEN` — Not the cell owner or admin

**`404 Not Found`** → `CELL_NOT_FOUND` — Cell does not exist

---

### 13.7b `POST /cells/:id/transfer-ownership` ★ NEW

Transfer cell group ownership to a new leader and/or G12 leader.

**Who can transfer:**

| Caller | Access |
|--------|--------|
| `admin` / `super_admin` | ✅ Full override — can change any combination of fields |
| `leader` / `g12` / `member` / `student` | ❌ `403 FORBIDDEN` |

On success the new owner(s) receive:
- An **in-app notification**: *"Cell Leadership Assigned"* / *"G12 Leadership Assigned"*
- An **email** with the assignment details

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`
**Content-Type:** `application/json`

#### Request Body

```json
{
  "leaderUid":    "new-leader-uid",
  "g12LeaderUid": "new-g12-uid"
}
```

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `leaderUid` | string | Conditional | New cell leader UID. At least one of `leaderUid` / `g12LeaderUid` must be provided. |
| `g12LeaderUid` | string | Conditional | New G12 leader UID. |

> At least one field must differ from the current owners — submitting the same UIDs returns `422 NO_CHANGE`.

> Only `admin` and `super_admin` can initiate ownership transfer. No auto-demotion occurs — the previous owner retains their role unless separately demoted via `POST /users/:uid/demote`.

#### Notifications sent on success

| Recipient | Channel | Message |
|-----------|---------|---------|
| New leader (if changed) | In-app + Email | *"You have been assigned as Cell Leader of [Cell Name]"* |
| New G12 leader (if changed, different person) | In-app + Email | *"You have been assigned as G12 Leader of [Cell Name]"* |

#### Responses

**`200 OK`** — Updated `CellGroup` object with new `leaderUid` and/or `g12LeaderUid`.

**`400 Bad Request`** → `VALIDATION_ERROR` — No fields provided

**`403 Forbidden`** → `FORBIDDEN` — Caller is not admin or super_admin

**`404 Not Found`** → `CELL_NOT_FOUND`

**`409 Conflict`** → `INVALID_STATE` — Cell is archived; cannot transfer ownership of archived cell

**`422 Unprocessable Entity`** → `NO_CHANGE`
```json
{ "error": { "code": "NO_CHANGE", "message": "The provided UIDs are the same as the current owners." }, "requestId": "..." }
```

---
### 13.8 `POST /cells/:id/members`

Directly add members to a cell (admin/leader/g12 path — no join request needed). Used when a leader physically recruits a member and adds them on their behalf. Atomically increments `memberCount`.

**Authentication:** Bearer required | **Roles:** Owning `leader`, `g12`, `admin`, `super_admin`

```json
{ "userUids": ["usr-mem2", "usr-mem3"] }
```

**`200 OK`** → `{ "added": ["usr-mem2", "usr-mem3"], "memberCount": 10 }`

---

### 13.9 `DELETE /cells/:id/members/:uid`

Remove a member from the cell. Atomically decrements `memberCount`.

**Authentication:** Bearer required | **Roles:** Owning `leader`, `g12`, `admin`, `super_admin`

**`200 OK`** → `{ "removed": "usr-mem2", "memberCount": 9 }`

---

### 13.10 `POST /cells/:id/join-requests`

Member applies to join a cell group. Admin or Super Admin must approve before the member is added to the cell.

**Authentication:** Bearer required | **Roles:** `member`, `student`

```json
{ "message": "I would like to join this cell group." }
```

| Field | Required | Notes |
|-------|:--------:|-------|
| `message` | No | Optional note from the applicant |

**`201 Created`**
```json
{
  "id":          "jreq-001",
  "cellId":      "cell-001",
  "cellName":    "Rathmalana West G12",
  "requesterUid": "usr-mem1",
  "message":     "I would like to join this cell group.",
  "status":      "pending",
  "createdAt":   "2026-05-16T09:00:00.000Z"
}
```

**`409 Conflict`** → `CELL_JOIN_REQUEST_PENDING` — already has a pending request for this cell

---

### 13.11 `GET /cells/:id/join-requests`

List all pending join requests for a cell.

**Authentication:** Bearer required | **Roles:** Owning `leader`, `g12`, `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `status` | `pending` \| `approved` \| `rejected` (default: `pending`) |
| `limit`, `cursor` | Pagination |

**`200 OK`**
```json
{
  "items": [{
    "id":            "jreq-001",
    "cellId":        "cell-001",
    "requesterUid":  "usr-mem1",
    "requesterName": "Sapna Nethmini",
    "message":       "I would like to join this cell group.",
    "status":        "pending",
    "createdAt":     "2026-05-16T09:00:00.000Z",
    "decidedAt":     null,
    "decisionNote":  null
  }],
  "nextCursor": null, "total": 3
}
```

---

### 13.12 `POST /cells/:id/join-requests/:rid/approve`

Approve a member's request to join the cell. Adds the member to the cell and increments `memberCount`.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

```json
{ "note": "Welcome to the cell!" }
```

**`200 OK`**
```json
{
  "joinRequestId": "jreq-001",
  "memberUid":     "usr-mem1",
  "memberCount":   9,
  "message":       "Member added to cell group."
}
```

**`409 Conflict`** → `INVALID_STATE` — request already decided

---

### 13.13 `POST /cells/:id/join-requests/:rid/reject`

Reject a member's request to join the cell. The member is not added.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

```json
{ "note": "Cell is currently full." }
```

**`200 OK`** — JoinRequest with `status: "rejected"`.

**`409 Conflict`** → `INVALID_STATE` — request already decided

---

## 14. Cell Report Endpoints — NEW V2

Reports are **immutable once filed** (FR-CR-014). Corrections: void the report and file a new corrected one.

Include `X-Idempotency-Key: <client-uuid>` on every `POST /cells/:id/reports`. Same key → returns existing report with `200 OK` (FR-CR-015 / NFR-AVA-004).

> **RBAC (SRS §9.3):** Only the owning Leader, G12 Leader, or Super Admin may file. Regular **Admin cannot**. Members cannot regardless of membership (FR-MEM-007).

**Typical mobile flow for filing a report:**
1. `GET /cells/:id` — fetch cell roster to pre-populate the attendance / absent-members fields
2. `POST /cells/:id/reports` — file the report **with photos attached in the same request** (`multipart/form-data`; photos are optional)

---

### 14.0 `POST /cells/:id/report-photos` — NEW

Upload 1–10 meeting photos **before** filing the report. Returns public URLs to include in `photoUrls[]` when calling `POST /cells/:id/reports`.

**Authentication:** Bearer required | **Roles:** Owning leader, G12, `super_admin`
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `photos` | file(s) | Yes | Field name `photos`; 1–10 files; `image/jpeg` or `image/png`; max **5 MB** each |

**`201 Created`**
```json
{ "photoUrls": [
    "https://storage.googleapis.com/bucket/cells/cell-001/report-photos/1716000000000-1.jpg",
    "https://storage.googleapis.com/bucket/cells/cell-001/report-photos/1716000000000-2.jpg"
] }
```

**`400`** → `VALIDATION_ERROR` (no files or > 10 files)
**`413`** → `FILE_TOO_LARGE` (a single photo exceeds 5 MB)
**`415`** → `UNSUPPORTED_MEDIA_TYPE` (non-JPEG/PNG file)

---

### 14.1 `GET /cells/:id/reports`

**Authentication:** Bearer required | **Roles:** Member of cell, owning leader/G12, `admin`+

| Parameter | Description |
|-----------|-------------|
| `from`, `to` | ISO date range |
| `voided` | `true` \| `false` (default `false`) |
| `limit`, `cursor` | Pagination |

**`200 OK`** — Paginated CellReport list.

---

### 14.2 `POST /cells/:id/reports`

File a cell meeting report. Photos are uploaded **in the same request** as `multipart/form-data` — no separate upload step needed.

`filledByUid` is system-populated from the authenticated user — read-only (FR-CR-002).

**Frontend UX notes:**
- **Leader name** — auto-display from `GET /me` (`firstName + lastName`); shown as read-only
- **Date** — defaults to today; editable
- **Names of members absent** — pre-populate from `GET /cells/:id` member roster as removable chips. Each chip has a ✕ button. Leader taps ✕ to remove members who **were present**; remaining chips = absent members. Pass them as `attendance[]` entries with `status: "absent"`

**Authentication:** Bearer required | **Roles:** Owning leader, owning G12, `super_admin`
**Content-Type:** `multipart/form-data`
**Header:** `X-Idempotency-Key: <client-uuid>` (required)

#### Request Fields

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `data` | string (JSON) | Yes | All report fields serialised as a JSON string |
| `photos` | file(s) | No | 0–10 JPEG/PNG images, max **5 MB** each. Named `[Image #1]` through `[Image #10]` in the UI |

#### `data` JSON structure

```json
{
  "date":                   "2026-05-15",
  "didMeet":                true,
  "leaderPresent":          true,
  "location":               "TCCR",
  "timeStarted":            "2026-05-15T18:00:00+05:30",
  "timeEnded":              "2026-05-15T19:30:00+05:30",
  "language":               "si",
  "subjectDiscussed":       "sunday_sermon",
  "cellType":               "g12",
  "g12LeaderUid":           "usr-g12-1",
  "immediateG12LeaderText": null,
  "attendance": [
    { "userUid": "usr-mem1", "name": "Sapna Nethmini", "status": "present", "isNew": false },
    { "userUid": "usr-mem2", "name": "Viruli W.",       "status": "absent",  "isNew": false },
    { "name":    "Walk-in",                              "status": "present", "isNew": true  }
  ],
  "contactedAbsentees":   "yes",
  "absenteeNotes":        "Called Viruli — will attend next week.",
  "additionalVisitors":   1,
  "childrenCount":        2,
  "satisfactionRate":     4,
  "additionalInfo":       "Great session."
}
```

| Field | Required | Condition | Notes |
|-------|:--------:|-----------|-------|
| `date` | Yes | — | ISO date `YYYY-MM-DD`; defaults to today on mobile (FR-CR-003) |
| `didMeet` | Yes | — | If `false`, only `noMeetReason` needed; all meeting fields ignored (FR-CR-004) |
| `noMeetReason` | When `didMeet=false` | — | Free text |
| `leaderPresent` | Yes | `didMeet=true` | FR-CR-005 |
| `conductedByIfAbsent` | When `leaderPresent=false` | — | Substitute name |
| `location` | Yes | `didMeet=true` | `TCCR` \| `Online` \| `Other` \| free text (FR-CR-006) |
| `timeStarted`, `timeEnded` | Yes | `didMeet=true` | ISO datetime with timezone |
| `language` | Yes | `didMeet=true` | `si` \| `ta` \| `en` |
| `subjectDiscussed` | Yes | `didMeet=true` | `sunday_sermon` \| `other` |
| `otherSubjectReason` | When `subjectDiscussed=other` | — | Free text |
| `cellType` | No | — | `g12` \| `care` \| `children` \| `outreach`; defaults to parent cell's type |
| `g12LeaderUid` | Yes | `didMeet=true` | From G12 leader dropdown (FR-CR-009) |
| `immediateG12LeaderText` | No | — | Free-text offline reference (FR-CR-009) |
| `attendance` | Yes | `didMeet=true` | Pre-populated from `GET /cells/:id` roster; `isNew:true` for walk-ins (FR-CR-010) |
| `contactedAbsentees` | Yes | `didMeet=true` | `"yes"` \| `"no"` \| `"future"` (FR-CR-011) |
| `absenteeNotes` | No | — | Notes on absent members (FR-CR-011) |
| `additionalVisitors` | Yes | `didMeet=true` | Count; 0 if none (FR-CR-012) |
| `childrenCount` | Yes | `didMeet=true` | Count; 0 if none (FR-CR-012) |
| `satisfactionRate` | Yes | `didMeet=true` | Integer **1–6** (FR-CR-013) |
| `additionalInfo` | No | — | Additional notes (FR-CR-013) |

**`201 Created`** — CellReport object with `photoUrls[]` populated. (Same key resubmit → **`200 OK`**)

---

### 14.3 `GET /cells/:id/reports/:rid`

**Authentication:** Bearer required | **Roles:** Member of cell, owning leader/G12, `admin`+

**`200 OK`** — Full CellReport object. | **`404`** → `CELL_REPORT_NOT_FOUND`

---

### 14.4 `POST /cells/:id/reports/:rid/void`

Void a report (FR-CR-014). Preserved for audit. File corrected report separately.

**Authentication:** Bearer required | **Roles:** Owning leader/G12, `admin`+

```json
{ "reason": "Wrong date. Corrected report filed separately." }
```

**`200 OK`** — CellReport with `voided: true`.

**`409`** → `REPORT_ALREADY_VOIDED`

---

### 14.5 `PATCH /cells/:id/reports/:rid` ★ NEW

Edit a cell report. Only allowed within **24 hours** of the original filing time. After that the report becomes read-only.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `super_admin`

**Who can edit:**

| Caller | Can edit? |
|--------|----------|
| The user who filed the report (`filledByUid`) | ✅ Yes (within 24h) |
| `super_admin` | ✅ Yes (within 24h) |
| Different leader / G12 (not the filer) | ❌ `403 FORBIDDEN` |
| `admin` | ❌ `403 FORBIDDEN` (admin does not file reports) |

**Immutable fields** — never changed by this endpoint:
`clientReqId`, `filledByUid`, `cellId`, `id`, `createdAt`

#### Request Body (all fields optional — PATCH semantics)

```json
{
  "location":         "Church Hall",
  "satisfactionRate": 5,
  "additionalInfo":   "Great attendance today.",
  "attendance": [
    { "name": "Kasun Perera", "status": "present", "isNew": false }
  ]
}
```

> At least one field must be provided. Sending an empty body returns `400 VALIDATION_ERROR`.

#### Responses

**`200 OK`** — Updated report object.

**`400 Bad Request`** → `VALIDATION_ERROR` — Empty body or field validation failure

**`403 Forbidden`** → `FORBIDDEN` — Not the original filer or super_admin

**`404 Not Found`** → `CELL_NOT_FOUND` / `REPORT_NOT_FOUND`

**`409 Conflict`** → `REPORT_ALREADY_VOIDED` — Cannot edit a voided report

**`422 Unprocessable Entity`** → `EDIT_WINDOW_EXPIRED`
```json
{ "error": { "code": "EDIT_WINDOW_EXPIRED", "message": "Cell reports can only be edited within 24 hours of filing." }, "requestId": "..." }
```

---
### 14.6 `GET /cells/network/reports` ★ NEW

Returns reports from all cells in the caller's network. G12 leaders see reports from every cell where they are the `g12LeaderUid`. Cell leaders see their own cell's reports. Admin sees all cells.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `limit` | Reports per cell (default 20, max 100) |
| `from` | Filter by date (`YYYY-MM-DD`) |
| `to` | Filter by date (`YYYY-MM-DD`) |
| `voided` | `true` \| `false` (default: non-voided) |

#### Scope by role

| Caller | Sees |
|--------|------|
| `g12` | All reports from cells where `g12LeaderUid === callerUid` |
| `leader` | Reports from their own cell only (`leaderUid === callerUid`) |
| `admin` / `super_admin` | Reports from all active cells |

#### Response

**`200 OK`**
```json
{
  "items": [
    {
      "id":         "report-001",
      "cellId":     "cell-001",
      "cellName":   "Rathmalana West G12",
      "date":       "2026-05-22",
      "didMeet":    true,
      "filledByUid": "leader-uid-1",
      ...
    }
  ],
  "totalCells": 8
}
```

> Reports are sorted by `date` descending (newest first). The `cellName` field is added automatically for each report item. `totalCells` = number of cells in the caller's network.

**`403 Forbidden`** → `FORBIDDEN` — member or student (not leader/G12/admin)

---
## 15. Analytics Endpoints — NEW V2

All endpoints read from **pre-aggregated snapshots** — never raw reports. <2 s latency (NFR-PER-003). Scope auto-resolved from caller's role.

---

### 15.1 `GET /analytics/cells/weekly`

Weekly cell-count and active-cell trend (FR-ANL-001).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

| Parameter | Default | Description |
|-----------|:-------:|-------------|
| `weeks` | 12 | Past weeks to return (max 52) |

**`200 OK`**
```json
{
  "scope": "leader:usr-leader1", "periodType": "weekly",
  "data": [
    { "periodKey": "2026-W18", "cellCount": 3, "activeCells": 3, "reportCount": 3 },
    { "periodKey": "2026-W19", "cellCount": 3, "activeCells": 2, "reportCount": 2 }
  ]
}
```

---

### 15.2 `GET /analytics/attendance`

Attendance trend (FR-ANL-002).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `from`, `to` | Period key range `YYYY-WW` |

**`200 OK`**
```json
{
  "scope": "g12:usr-g12-1",
  "data": [{ "periodKey": "2026-W18", "present": 42, "absent": 6, "visitors": 3, "children": 5, "newAttendees": 2 }]
}
```

---

### 15.3 `GET /analytics/meeting-types`

Meeting-type breakdown (FR-ANL-002).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**`200 OK`**
```json
{ "scope": "org", "period": "2026-W18", "breakdown": { "g12": 12, "care": 8, "children": 4, "outreach": 3 } }
```

---

### 15.4 `GET /analytics/growth`

Member growth and retention trend (FR-ANL-003).

**Authentication:** Bearer required | **Roles:** `g12`, `admin`, `super_admin`

**`200 OK`**
```json
{ "scope": "org", "data": [{ "periodKey": "2026-W18", "memberGrowth": 5, "participationRate": 0.87 }] }
```

---

### 15.5 `GET /analytics/participation`

Participation per leader (FR-ANL-003).

**Authentication:** Bearer required | **Roles:** `g12`, `admin`, `super_admin`

**`200 OK`**
```json
{
  "scope": "g12:usr-g12-1",
  "data": [{ "leaderUid": "usr-leader1", "leaderName": "Sithuru K.", "averageAttendance": 7.5, "cellCount": 2 }]
}
```

---

### 15.6 `GET /analytics/:chart/export`

CSV export (FR-ANL-005). `:chart` — one of `cells-weekly`, `attendance`, `meeting-types`, `growth`, `participation`

**Authentication:** Bearer required | **Roles:** `g12`, `admin`, `super_admin`

Same query parameters as the corresponding chart endpoint.

**`200 OK`** — `Content-Type: text/csv`; `Content-Disposition: attachment; filename="analytics-export.csv"`

---

## 16. Notification Endpoints

---

### 16.1 `GET /me/notifications`

**Authentication:** Bearer required | **Roles:** Any

| Parameter | Description |
|-----------|-------------|
| `read` | `true` \| `false` |
| `limit`, `cursor` | Pagination |

**`200 OK`**
```json
{
  "items": [{
    "id": "notif-001", "type": "role.granted",
    "title": "Role Granted",
    "body": "You are now a Student in the TCCR system.",
    "read": false,
    "createdAt": "2026-05-15T09:05:00.000Z"
  }],
  "nextCursor": null, "total": 5
}
```

---

### 16.2 `POST /me/notifications/:id/read`

**Authentication:** Bearer required | **Roles:** Any (own notifications only)

**`200 OK`** — `{ "id": "<notificationId>", "read": true }`

---

### 16.3 `POST /me/notifications/read-all`

**Authentication:** Bearer required | **Roles:** Any

**`204 No Content`**

---

## 17. Audit Log Endpoints

---

### 17.1 `GET /audit-log`

Organisation-wide audit log (FR-SADM-007 / FR-ADM-005).

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `actorUid` | Filter by actor UID |
| `action` | Filter by action key (exact match) |
| `category` | Filter by category |
| `targetType`, `targetId` | Filter by target entity |
| `from`, `to` | ISO datetime range |
| `limit`, `cursor` | Pagination |

**`200 OK`**
```json
{
  "items": [{
    "id": "log-001", "when": "2026-05-07T14:00:00.000Z",
    "actor": { "uid": "admin-uid-xyz", "email": "admin@tccr.lk" },
    "action": "enrollment.approved", "category": "enrollment",
    "targetType": "enrollment", "targetId": "enr-abc",
    "requestId": "7f3a1c2d-..."
  }],
  "nextCursor": null, "total": 142
}
```

> `before`/`after` state snapshots stored internally; excluded from API responses.

---

### 17.2 `GET /users/:uid/audit-log` — NEW V2

Per-user audit timeline — actor or target entries.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

Same query parameters as `GET /audit-log`.

**`200 OK`** — Same shape as `GET /audit-log`.

---

## 18. Admin Management — Super Admin

V1 endpoints carry forward unchanged.

---

### 18.1 `GET /super-admin/admins`

**Authentication:** Bearer required | **Roles:** `super_admin`

**`200 OK`** — Paginated User list (roles includes `admin`).

---

### 18.2 `POST /super-admin/admins`

Create Admin account (FR-SADM-001).

**Authentication:** Bearer required | **Roles:** `super_admin`

```json
{
  "firstName": "Ushani", "lastName": "Amanda",
  "email": "ushani@tccr.lk",
  "initialPassword": "Admin@2026X",
  "preferredLanguage": "en"
}
```

**`201 Created`** — User with `roles: ["admin"]`.

---

### 18.3 `GET /super-admin/admins/:uid`

**Authentication:** Bearer required | **Roles:** `super_admin`

**`200 OK`** — User object.

---

### 18.4 `POST /super-admin/admins/:uid/suspend`

**Authentication:** Bearer required | **Roles:** `super_admin`

**`200 OK`** — User with `status: "suspended"`.

---

### 18.5 `POST /super-admin/admins/:uid/reactivate`

**Authentication:** Bearer required | **Roles:** `super_admin`

**`200 OK`** — User with `status: "approved"`.

---

### 18.6 `DELETE /super-admin/admins/:uid`

Soft-delete.

**Authentication:** Bearer required | **Roles:** `super_admin`

**`204 No Content`**

---

### 18.7 `POST /super-admin/users/:uid/make-admin`

Promote student to Admin. User retains both `student` and `admin` roles (dual-role).

**Authentication:** Bearer required | **Roles:** `super_admin`

**`200 OK`** — User with `roles: ["student", "admin"]`.

**`409`** → `INVALID_ROLE` (user is not a student)

---

## 19. Health Endpoints

---

### 19.1 `GET /healthz`

Liveness probe.

**`200 OK`** → `{ "status": "ok", "service": "api-gateway" }`

---

### 19.2 `GET /readyz`

Readiness probe.

**`200 OK`** → `{ "status": "ready" }`

**`503`** → `{ "status": "not_ready", "error": "Firestore unreachable" }`

---

## 20. Data Models

---

### User

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Firebase Auth UID |
| `email` | string | Unique |
| `firstName` | string | |
| `lastName` | string | |
| `preferredLanguage` | string | `si` \| `ta` \| `en` — defaults to `en` — **NEW V2** |
| `roles` | string[] | `member`, `student`, `leader`, `g12`, `admin`, `super_admin` — **NEW V2** (was scalar `role` in V1) |
| `providers` | string[] | `password`, `google.com`, `apple.com` — **NEW V2** |
| `status` | string | `approved` \| `suspended` |
| `profilePhotoUrl` | string or null | |
| `notificationPreferences` | object | `{ email: boolean, push: boolean }` — **NEW V2** (FR-NOT-006) |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |
| `deletedAt` | string or null | Non-null = soft-deleted |

---

### RoleRequest — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `requesterUid` | string | FK → users |
| `requestedRole` | string | `"student"` — only value at this stage |
| `status` | string | `pending` \| `approved` \| `rejected` |
| `applicantProfile` | ApplicantProfile | Snapshot taken at submission time — see below |
| `qualificationTitle` | string or null | Admin-visible label for the qualification PDF |
| `qualificationStoragePath` | string or null | Internal Firebase Storage path — use `GET /role-requests/:id/qualification` to obtain a signed URL |
| `decidedByUid` | string or null | UID of admin who approved/rejected |
| `decisionNote` | string or null | Optional note from the reviewer |
| `createdAt` | string | ISO 8601 |
| `decidedAt` | string or null | ISO 8601 — set when status changes from `pending` |
| `memberProfile` | MemberProfile or null | **Admin only** — live member profile fetched from user-service; `null` for non-admin callers or if user-service is unavailable |

#### ApplicantProfile

Nested inside `RoleRequest.applicantProfile`. Snapshot of the member's profile at the time they submitted the request. May differ from current live data.

| Field | Type | Notes |
|-------|------|-------|
| `firstName` | string | 1–100 chars |
| `lastName` | string | 1–100 chars |
| `phoneNumber` | string or null | 5–30 chars |
| `email` | string | Valid email address |
| `dateOfBirth` | string or null | `YYYY-MM-DD` |
| `gender` | string or null | `male` \| `female` \| `other` |
| `address` | string or null | 1–500 chars |
| `qualificationTitle` | string or null | Label snapshotted from the uploaded PDF |
| `qualificationUrl` | string or null | Firebase Storage URL snapshotted at submission |

#### MemberProfile ★ NEW

Live member profile included in `GET /role-requests/:id` responses **for admin and super_admin callers only**. Always reflects the member's current state — use this for the approval review UI.

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Firebase Auth UID |
| `email` | string | Current registered email |
| `firstName` | string | Current first name |
| `lastName` | string | Current last name |
| `phoneNumber` | string or null | Current phone number |
| `profilePhotoUrl` | string or null | Current avatar URL (Firebase Storage) |
| `dateOfBirth` | string or null | `YYYY-MM-DD` |
| `gender` | string or null | `male` \| `female` \| `other` |
| `address` | string or null | Current address |
| `preferredLanguage` | string | `en` \| `si` \| `ta` |
| `roles` | string[] | Current roles array e.g. `["member"]` |
| `status` | string | `approved` \| `pending_approval` \| `suspended` \| `rejected` |
| `accountCreatedAt` | string | ISO 8601 — when the user account was registered |
| `qualifications` | Qualification[] | All uploaded qualifications (ordered list) |

#### Qualification (inside MemberProfile.qualifications)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `title` | string | e.g. "Bachelor of Theology" |
| `fileUrl` | string or null | Firebase Storage download URL; `null` if no PDF uploaded |

---

### Course

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `title` | string | Unique (incl. soft-deleted) |
| `description` | string | Max 500 chars |
| `coverImageUrl` | string or null | |
| `state` | string | `draft` \| `published` \| `archived` |
| `semesterCount` | number | |
| `batchCount` | number | **NEW V2** |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |
| `deletedAt` | string or null | |

---

### Batch — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `courseId` | string | FK → courses |
| `name` | string | Unique within course |
| `scheduledOpenAt` | string or null | ISO 8601 datetime — batch auto-opens at this time via Scheduled Jobs |
| `intakeStart` | string | ISO date — enrollment window opens |
| `intakeEnd` | string | ISO date — enrollment window auto-closes when this passes |
| `capacity` | number or null | Optional max student cap |
| `state` | string | `draft` → `open` → `closed` |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### Semester

| Field | Type | V2 Change |
|-------|------|-----------|
| `id` | string | |
| `courseId` | string | |
| `title` | string | |
| `number` | number | Sequence within course |
| `openDate` | string | **NEW** — ISO date; content accessible from this date |
| `endDate` | string or null | **NEW** — auto-disables after this date |
| `status` | string | `active` \| `disabled` |
| `subjectCount` | number | |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |
| `deletedAt` | string or null | |

---

### Subject

| Field | Type | V2 Change |
|-------|------|-----------|
| `id` | string | |
| `semesterId` | string | |
| `courseId` | string | |
| `title` | string | |
| `description` | string | |
| `order` | number | |
| `imageUrls` | string[] | **NEW** — PNG/JPG cover images (FR-CRS-005) |
| `attachments` | Attachment[] | PDF/DOCX |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |
| `deletedAt` | string or null | |

---

### Lesson

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `subjectId` | string | |
| `courseId` | string | |
| `semesterId` | string | |
| `title` | string | |
| `description` | string | Max 2000 chars |
| `youtubeVideoId` | string or null | 11-char ID; extracted from URL on write; rendered via YouTube IFrame Player API (FR-LRN-001) |
| `attachmentIds` | string[] | IDs of associated Attachments |
| `order` | number | Auto-assigned sequential within subject |
| `deletedAt` | string or null | |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### Attachment

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `subjectId` | string | |
| `courseId` | string | |
| `filename` | string | Original file name |
| `mimeType` | string | PDF/DOC/DOCX + `image/png`, `image/jpeg` (**V2 adds PNG/JPG**) |
| `sizeBytes` | number | |
| `storagePath` | string | Internal Cloud Storage path |
| `createdAt` | string | ISO 8601 |

---

### Enrollment

| Field | Type | V2 Change |
|-------|------|-----------|
| `id` | string | `${userUid}_${batchId}` — **changed** (was `${uid}_${courseId}` in V1) |
| `userUid` | string | |
| `courseId` | string | |
| `batchId` | string | **NEW** — FK → batches |
| `roleRequestId` | string or null | **NEW** — links to originating role request |
| `status` | string | `pending` \| `approved` \| `withdrawn` \| `rejected` |
| `enrolledAt` | string or null | Set on approval |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### SubjectProgress

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `${userUid}_${subjectId}` |
| `userUid` | string | |
| `subjectId` | string | |
| `courseId` | string | |
| `semesterId` | string | |
| `batchId` | string | **NEW V2** — enables cohort-level progress reporting |
| `status` | string | `not_started` \| `in_progress` \| `completed` |
| `completedAt` | string or null | ISO 8601; immutable once set |
| `lastAccessedAt` | string or null | ISO 8601; updated on lesson open |

---

### CellJoinRequest — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `cellId` | string | FK → cell_groups |
| `requesterUid` | string | FK → users |
| `message` | string or null | Optional note from applicant |
| `status` | string | `pending` \| `approved` \| `rejected` |
| `decidedByUid` | string or null | Admin who approved/rejected |
| `decisionNote` | string or null | Admin note |
| `createdAt` | string | ISO 8601 |
| `decidedAt` | string or null | ISO 8601 |

---

### CellGroup — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `name` | string | |
| `type` | string | `g12` \| `care` \| `children` \| `outreach` |
| `area` | string | Geographic area / district |
| `leaderUid` | string | FK → users |
| `g12LeaderUid` | string | FK → users |
| `members` | string[] | Array of member UIDs |
| `memberCount` | number | Denormalised; incremented atomically (FR-CG-007) |
| `reportCount` | number | Denormalised; incremented atomically (FR-CG-007) |
| `state` | string | `active` \| `archived` |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### CellReport — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `cellId` | string | FK → cell_groups |
| `filledByUid` | string | System-populated; read-only (FR-CR-002) |
| `clientReqId` | string | Client UUID for idempotent offline retry (FR-CR-015) |
| `date` | string | ISO date |
| `didMeet` | boolean | FR-CR-004 |
| `noMeetReason` | string or null | Required when `didMeet=false` |
| `leaderPresent` | boolean | FR-CR-005 |
| `conductedByIfAbsent` | string or null | Required when `leaderPresent=false` |
| `location` | string | FR-CR-006 |
| `timeStarted` / `timeEnded` | string | ISO datetime (FR-CR-006) |
| `language` | string | `si` \| `ta` \| `en` (FR-CR-006) |
| `subjectDiscussed` | string | `sunday_sermon` \| `other` (FR-CR-007) |
| `otherSubjectReason` | string or null | FR-CR-007 |
| `cellType` | string | `g12` \| `care` \| `children` \| `outreach`; defaults to parent cell's type (FR-CR-008) |
| `g12LeaderUid` | string | From system roster (FR-CR-009) |
| `immediateG12LeaderText` | string or null | Free-text offline reference (FR-CR-009) |
| `attendance` | AttendanceEntry[] | `{ userUid?, name, status: "present"\|"absent"\|"new", isNew }` (FR-CR-010) |
| `contactedAbsentees` | boolean | FR-CR-011 |
| `absenteeNotes` | string or null | FR-CR-011 |
| `additionalVisitors` | number | FR-CR-012 |
| `childrenCount` | number | FR-CR-012 |
| `satisfactionRate` | number | 1–6 (FR-CR-013) |
| `additionalInfo` | string or null | FR-CR-013 |
| `voided` | boolean | Immutable once `true` (FR-CR-014) |
| `createdAt` | string | ISO 8601 |

---

### AnalyticsSnapshot — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `{scope}_{periodKey}` |
| `scope` | string | `leader:{uid}` \| `g12:{uid}` \| `org` |
| `periodKey` | string | `YYYY-WW` (weekly) or `YYYY-MM` (monthly) |
| `metrics` | object | Pre-aggregated: `cellCount`, `activeCells`, `reportCount`, `attendance`, `meetingTypeBreakdown`, `memberGrowth`, `participationRate`, `averageSatisfaction` |
| `computedAt` | string | ISO 8601 |

---

### Notification

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `recipientUid` | string | |
| `templateKey` | string | e.g. `role.granted`, `enrollment.approved`, `cell_report.filed` |
| `title` | string | Rendered in `localeRendered` |
| `body` | string | Rendered in `localeRendered` |
| `localeRendered` | string | `si` \| `ta` \| `en` — **NEW V2** (FR-NOT-001) |
| `channels` | string[] | `in_app`, `email`, `push` |
| `readAt` | string or null | ISO 8601; `null` when unread |
| `createdAt` | string | ISO 8601 |

---

### AuditLogEntry

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `when` | string | ISO 8601 (mapped from `createdAt`) |
| `actor` | object | `{ uid: string or null, email: string or null }` |
| `action` | string | Stable key, e.g. `role.granted`, `enrollment.approved` |
| `category` | string or null | Logical grouping, e.g. `enrollment`, `cell`, `auth` |
| `targetType` | string or null | Affected collection |
| `targetId` | string or null | Affected document ID |
| `requestId` | string | `X-Request-Id` from originating HTTP request |

> `before`/`after` snapshots stored internally; excluded from API responses.

---

## 21. Error Codes Reference

### V1 Codes (all preserved)

| Code | Status | Description |
|------|:------:|-------------|
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `INVALID_OTP` | 400 | OTP invalid or not found |
| `EMAIL_ALREADY_VERIFIED` | 400 | `POST /auth/resend-verification` called for an already-verified address ★ NEW |
| `OTP_EXPIRED` | 400 | OTP has passed its 15-minute expiry |
| `OTP_MAX_ATTEMPTS` | 400 | Too many incorrect OTP attempts |
| `FILE_TOO_LARGE` | 413 | File exceeds the size limit for that endpoint |
| `MISSING_TOKEN` | 401 | Authorization header absent |
| `INVALID_TOKEN` | 401 | Token expired, revoked, or malformed |
| `TOKEN_REVOKED` | 401 | Session has been revoked |
| `TOKEN_EXPIRED` | 401 | ID token has expired |
| `FORBIDDEN` | 403 | Valid token; insufficient role or ownership mismatch |
| `COURSE_NOT_FOUND` | 404 | Course not found |
| `USER_NOT_FOUND` | 404 | User not found |
| `SEMESTER_NOT_FOUND` | 404 | Semester not found |
| `SUBJECT_NOT_FOUND` | 404 | Subject not found |
| `LESSON_NOT_FOUND` | 404 | Lesson not found |
| `ATTACHMENT_NOT_FOUND` | 404 | Attachment not found |
| `ENROLLMENT_NOT_FOUND` | 404 | Enrollment not found |
| `REPORT_NOT_FOUND` | 404 | Cell report not found (returned by `PATCH /cells/:id/reports/:rid`) ★ NEW |
| `EMAIL_EXISTS` | 409 | Email already registered |
| `COURSE_TITLE_EXISTS` | 409 | Course name already in use |
| `ENROLLMENT_PENDING` | 409 | Pending enrollment already exists |
| `ALREADY_ENROLLED` | 409 | Active enrollment already exists |
| `INVALID_STATE` | 409 | Entity not in required state for this operation |
| `INVALID_ROLE` | 409 | User role does not permit this operation |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | File MIME type not allowed |
| `COOLOFF_ACTIVE` | 422 | Must wait before re-enrolling |
| `EMAIL_DOMAIN_UNREACHABLE` | 422 | Email domain has no MX DNS records — domain cannot receive email ★ NEW |
| `DISPOSABLE_EMAIL` | 422 | Disposable/throwaway email address not accepted at registration ★ NEW |
| `EDIT_WINDOW_EXPIRED` | 422 | Cell report can only be edited within 24 hours of filing ★ NEW |
| `NO_CHANGE` | 422 | Transfer ownership called with same UIDs as current owners ★ NEW |
| `EMAIL_DOMAIN_UNREACHABLE` | 422 | Email domain has no MX DNS records — cannot receive email (register) ★ NEW |
| `DISPOSABLE_EMAIL` | 422 | Disposable/throwaway email address not accepted (register) ★ NEW |
| `EDIT_WINDOW_EXPIRED` | 422 | Cell report can only be edited within 24 hours of filing ★ NEW |
| `NO_CHANGE` | 422 | Transfer ownership called with same UIDs as current owners ★ NEW |
| `NO_SEMESTERS` | 422 | Cannot publish: course has no semesters |
| `EMPTY_SEMESTER` | 422 | Cannot publish: semester has no subjects |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### V2 New Codes

| Code | Status | Description |
|------|:------:|-------------|
| `FEDERATED_TOKEN_INVALID` | 401 | Google or Apple ID token failed verification |
| `EMAIL_NOT_VERIFIED` | 401 | Federated sign-in with unverified email |
| `SEMESTER_DISABLED` | 403 | Semester's endDate passed; student not enrolled before cutoff |
| `BATCH_NOT_FOUND` | 404 | Batch not found |
| `ROLE_REQUEST_NOT_FOUND` | 404 | Role request not found |
| `CELL_NOT_FOUND` | 404 | Cell group not found |
| `CELL_REPORT_NOT_FOUND` | 404 | Cell report not found |
| `LAST_SUPER_ADMIN` | 409 | Cannot demote the only remaining Super Admin (FR-SADM-004) |
| `ROLE_REQUEST_PENDING` | 409 | Pending role request already exists for this role |
| `REPORT_ALREADY_VOIDED` | 409 | Report has already been voided |
| `CELL_JOIN_REQUEST_PENDING` | 409 | Member already has a pending join request for this cell |
| `BATCH_CLOSED` | 422 | Batch intake window closed at time of enrollment |

---

## 22. HTTP Status Code Reference

| Status | Meaning | When Used |
|:------:|---------|-----------|
| `200` | OK | Successful GET, PATCH, state-change POST |
| `201` | Created | Successful POST creating a new resource |
| `204` | No Content | Successful DELETE; logout; change-password; mark-all-read |
| `400` | Bad Request | Validation failure; invalid OTP |
| `401` | Unauthorized | Missing, expired, or revoked token |
| `413` | Payload Too Large | Uploaded file exceeds the size limit for that endpoint |
| `403` | Forbidden | Valid token; wrong role; ownership mismatch; semester disabled |
| `404` | Not Found | Resource not found; draft/archived course accessed by student |
| `409` | Conflict | Duplicate; invalid state transition; last super admin |
| `410` | Gone | Deprecated V1 endpoint removed in Phase 3 |
| `415` | Unsupported Media Type | Invalid file MIME type |
| `422` | Unprocessable Entity | Business rule violation (batch closed, no semesters, cooloff) |
| `429` | Too Many Requests | Rate limit — see `Retry-After` header |
| `500` | Internal Server Error | Unhandled exception; sanitised message returned |
| `502` | Bad Gateway | Upstream service unreachable |
| `503` | Service Unavailable | Readiness check failed |

---

## 23. Domain Events Reference

Events published to the `outbox` Firestore collection and dispatched by the Outbox Worker. At-least-once delivery; up to 5 retries with exponential backoff.

> **Wiring legend:** ✅ Wired in `EventDispatcher` and handler exists. ⚠️ Published to outbox but **not wired** in EventDispatcher — silently skipped (known gap). 🔇 Delivered to service but **no handler** exists in that service — silently dropped.

### V1 Events (all preserved)

| Event | Publisher | Wired Consumers | Trigger |
|-------|-----------|-----------------|---------|
| `user.registered` | Auth Service | ✅ Notification, ✅ Audit | Registration (payload expanded in V2) |
| `registration.approved` | Enrollment Service | ✅ Notification, ✅ Audit | V1 registration approval |
| `registration.rejected` | Enrollment Service | ✅ Notification, ✅ Audit | V1 registration rejection |
| `enrollment.pending` | Enrollment Service | ✅ Notification, ✅ Audit | Student submits enrollment |
| `enrollment.approved` | Enrollment Service | ✅ Notification, ✅ Audit | Admin approves enrollment |
| `enrollment.rejected` | Enrollment Service | ✅ Notification, ✅ Audit | Admin rejects enrollment |
| `enrollment.withdrawn` | Enrollment Service | ✅ Audit | Student withdraws |
| `course.published` | Course Service | 🔇 Notification (delivered but no handler — silently dropped), ✅ Audit | Course published |
| `progress.subjectCompleted` | Progress Service | ✅ Audit | Subject marked complete |
| `admin.created` | User Service | ✅ Notification (`AdminCreatedHandler` — 3 branches: promotion notice / leader+g12 welcome with credentials / default admin welcome), ✅ Audit | Admin/leader/g12 created or promoted |
| `admin.suspended` | User Service | ✅ Notification, ✅ Audit | Admin suspended |
| `audit.action` | Any service | ✅ Audit | Direct audit write |

### V2 New Events

| Event | Publisher | Wired Consumers | Trigger |
|-------|-----------|-----------------|---------|
| `role.requested` | Enrollment Service | ⚠️ Not wired — silently skipped | Member submits role request |
| `role.granted` | Enrollment Service | ✅ Notification (`RoleGrantedHandler` — in-app notification + approval email with role label, optional admin note, next-steps, login link), ✅ Audit | Admin approves role request |
| `role.rejected` | Enrollment Service | ⚠️ Not wired — silently skipped | Admin rejects role request |
| `cell.created` | Cell Service | ✅ Audit | Cell group created |
| `cell.join_requested` | Cell Service | ✅ Notification (leader + G12 leader in-app: "New Cell Join Request"), ✅ Audit | Member applies to join a cell — notifies owning leader and G12 leader ★ Updated |
| `cell.join_approved` | Cell Service | ✅ Notification (member in-app: "Cell Join Request Approved"), ✅ Audit | Admin approves member into cell ★ Updated |
| `cell.join_rejected` | Cell Service | ✅ Notification (member in-app: "Cell Join Request Not Approved"), ✅ Audit | Admin rejects cell join request ★ Updated |
| `cell_report.filed` | Cell Service | ✅ Notification (G12 leader in-app: "Cell Report Filed" — skipped if G12=filer), ✅ Audit | Leader files cell report ★ Updated |
| `cell_report.voided` | Cell Service | ✅ Audit | Cell report voided |
| `cell.ownership_transferred` | Cell Service | ✅ Auto-demotion of previous owner when self-initiated (`POST /internal/users/remove-role`), ✅ Notification (new leader + G12 in-app + email), ✅ Audit | Cell ownership transferred; previous owner auto-demoted when they initiated it ★ Updated |

**Delivery guarantees:**
- At-least-once; Outbox Worker retries up to **5 times** with exponential backoff
- Events failing all 5 attempts remain as `status: "failed"` for manual investigation
- `Promise.allSettled` across a batch — one failure does not block other events

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*
*Document version: 2.19.0 | Paired with TCCR SRS v2.0 dated 22 May 2026 and TCCR Backend Blueprint v2.0.0*
