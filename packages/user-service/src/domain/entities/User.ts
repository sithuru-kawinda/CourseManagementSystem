import { createHttpError } from '@shared/errors';

export type UserRole   = 'member' | 'student' | 'leader' | 'g12' | 'admin' | 'super_admin';
export type UserStatus = 'pending_approval' | 'approved' | 'rejected' | 'suspended';

export interface NotificationPreferences {
  email: boolean;
  push:  boolean;
}

export type Gender = 'male' | 'female' | 'other';

/** A single qualification entry — title + optional PDF URL */
export interface Qualification {
  id:       string;          // UUID (client-generated or server-assigned)
  title:    string;          // e.g. "Bachelor of Theology"
  fileUrl?: string | null;   // Firebase Storage download URL (undefined/null = no PDF)
}

export interface UserProps {
  uid:                      string;
  email:                    string;
  firstName:                string;
  lastName:                 string;
  role:                     UserRole;
  roles:                    UserRole[];
  status:                   UserStatus;
  profilePhotoUrl:          string | null;
  phoneNumber?:             string | null;
  preferredLanguage?:       string;
  fcmTokens?:               string[];
  notificationPreferences?: NotificationPreferences;
  providers?:               string[];
  // Extended profile fields — used by role request flow
  dateOfBirth?:             string | null;        // YYYY-MM-DD
  gender?:                  Gender | null;
  address?:                 string | null;
  qualifications?:          Qualification[];      // ordered list; [0] is sent with role request
  // Legacy single-qualification fields — kept for enrollment-service backward compat
  // Auto-synced from qualifications[0] when qualifications is updated via PATCH /me
  qualificationTitle?:      string | null;
  qualificationUrl?:        string | null;
  qualificationStoragePath?: string | null;
  createdAt:                string;
  updatedAt:                string;
  deletedAt:                string | null;
}

export class User {
  readonly uid:                string;
  readonly email:              string;
  firstName:                   string;
  lastName:                    string;
  readonly role:               UserRole;
  roles:                       UserRole[];
  status:                      UserStatus;
  profilePhotoUrl:             string | null;
  phoneNumber:                 string | null;
  preferredLanguage:           string;
  fcmTokens:                   string[];
  notificationPreferences:     NotificationPreferences;
  providers:                   string[];
  dateOfBirth:                 string | null;
  gender:                      Gender | null;
  address:                     string | null;
  qualifications:              Qualification[];
  qualificationTitle:          string | null;   // auto-synced from qualifications[0].title
  qualificationUrl:            string | null;   // auto-synced from qualifications[0].fileUrl
  qualificationStoragePath:    string | null;
  readonly createdAt:          string;
  updatedAt:                   string;
  deletedAt:                   string | null;

  constructor(props: UserProps) {
    this.uid                      = props.uid;
    this.email                    = props.email;
    this.firstName                = props.firstName;
    this.lastName                 = props.lastName;
    this.role                     = props.role;
    this.roles                    = props.roles;
    this.status                   = props.status;
    this.profilePhotoUrl          = props.profilePhotoUrl;
    this.phoneNumber              = props.phoneNumber ?? null;
    this.preferredLanguage        = props.preferredLanguage ?? 'en';
    this.fcmTokens                = props.fcmTokens ?? [];
    this.notificationPreferences  = props.notificationPreferences ?? { email: true, push: true };
    this.providers                = props.providers ?? ['password'];
    this.dateOfBirth              = props.dateOfBirth ?? null;
    this.gender                   = props.gender ?? null;
    this.address                  = props.address ?? null;
    this.qualifications           = props.qualifications ?? [];
    // Legacy single fields — auto-synced from qualifications[0]
    this.qualificationTitle       = props.qualificationTitle ?? this.qualifications[0]?.title ?? null;
    this.qualificationUrl         = props.qualificationUrl ?? this.qualifications[0]?.fileUrl ?? null;
    this.qualificationStoragePath = props.qualificationStoragePath ?? null;
    this.createdAt                = props.createdAt;
    this.updatedAt                = props.updatedAt;
    this.deletedAt                = props.deletedAt;
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isActive(): boolean {
    return this.status === 'approved' && this.deletedAt === null;
  }

  isSuspended(): boolean {
    return this.status === 'suspended';
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  suspend(): void {
    this.status    = 'suspended';
    this.updatedAt = new Date().toISOString();
  }

  reactivate(): void {
    this.status    = 'approved';
    this.updatedAt = new Date().toISOString();
  }

  approve(): void {
    this.status    = 'approved';
    this.updatedAt = new Date().toISOString();
  }

  updateProfile(fields: {
    firstName?:                string;
    lastName?:                 string;
    profilePhotoUrl?:          string | null;
    phoneNumber?:              string | null;
    preferredLanguage?:        string;
    dateOfBirth?:              string | null;
    gender?:                   Gender | null;
    address?:                  string | null;
    qualifications?:           Qualification[];
    // Legacy single fields (still accepted for backward compat with upload use case)
    qualificationTitle?:       string | null;
    qualificationUrl?:         string | null;
    qualificationStoragePath?: string | null;
  }): void {
    if (fields.firstName                !== undefined) this.firstName                = fields.firstName;
    if (fields.lastName                 !== undefined) this.lastName                 = fields.lastName;
    if (fields.profilePhotoUrl          !== undefined) this.profilePhotoUrl          = fields.profilePhotoUrl;
    if (fields.phoneNumber              !== undefined) this.phoneNumber              = fields.phoneNumber;
    if (fields.preferredLanguage        !== undefined) this.preferredLanguage        = fields.preferredLanguage;
    if (fields.dateOfBirth              !== undefined) this.dateOfBirth              = fields.dateOfBirth;
    if (fields.gender                   !== undefined) this.gender                   = fields.gender;
    if (fields.address                  !== undefined) this.address                  = fields.address;
    if (fields.qualifications           !== undefined) {
      this.qualifications     = fields.qualifications;
      // Auto-sync legacy single fields from the first qualification entry
      this.qualificationTitle = this.qualifications[0]?.title   ?? null;
      this.qualificationUrl   = this.qualifications[0]?.fileUrl ?? null;
    }
    if (fields.qualificationTitle       !== undefined) this.qualificationTitle       = fields.qualificationTitle;
    if (fields.qualificationUrl         !== undefined) this.qualificationUrl         = fields.qualificationUrl;
    if (fields.qualificationStoragePath !== undefined) this.qualificationStoragePath = fields.qualificationStoragePath;
    this.updatedAt = new Date().toISOString();
  }

  registerFcmToken(token: string): void {
    if (!this.fcmTokens.includes(token)) {
      this.fcmTokens = [...this.fcmTokens, token];
      this.updatedAt = new Date().toISOString();
    }
  }

  linkProvider(providerId: string): void {
    if (!this.providers.includes(providerId)) {
      this.providers = [...this.providers, providerId];
      this.updatedAt = new Date().toISOString();
    }
  }

  unlinkProvider(providerId: string): void {
    if (this.providers.length <= 1) {
      throw createHttpError(409, 'INVALID_STATE', 'Cannot remove the only sign-in provider.');
    }
    this.providers = this.providers.filter(p => p !== providerId);
    this.updatedAt = new Date().toISOString();
  }

  deregisterFcmToken(token: string): void {
    const before = this.fcmTokens.length;
    this.fcmTokens = this.fcmTokens.filter(t => t !== token);
    if (this.fcmTokens.length !== before) {
      this.updatedAt = new Date().toISOString();
    }
  }

  updateNotificationPreferences(prefs: Partial<NotificationPreferences>): void {
    this.notificationPreferences = {
      email: prefs.email ?? this.notificationPreferences.email,
      push:  prefs.push  ?? this.notificationPreferences.push,
    };
    this.updatedAt = new Date().toISOString();
  }

  addRole(role: UserRole): void {
    if (!this.roles.includes(role)) {
      this.roles     = [...this.roles, role];
      this.updatedAt = new Date().toISOString();
    }
  }

  removeRole(role: UserRole): void {
    if (role === 'member') return; // member can never be removed
    this.roles     = this.roles.filter(r => r !== role);
    this.updatedAt = new Date().toISOString();
  }

  softDelete(): void {
    this.deletedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
}
