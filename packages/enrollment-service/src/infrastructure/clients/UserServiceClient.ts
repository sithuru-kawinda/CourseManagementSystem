import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export class UserServiceClient {
  private readonly http = createInternalClient(config.serviceUserUrl, config.internalServiceKey);

  async approveUser(uid: string): Promise<void> {
    await this.http.post('/internal/users/approve', { uid });
  }

  async addRole(uid: string, role: string): Promise<void> {
    await this.http.post('/internal/users/add-role', { uid, role });
  }

  async getUser(uid: string): Promise<{
    email:                string;
    firstName:            string;
    lastName:             string;
    phoneNumber:          string | null;
    dateOfBirth:          string | null;
    gender:               string | null;
    address:              string | null;
    qualificationTitle:   string | null;  // from qualifications[0].title (auto-synced)
    qualificationUrl:     string | null;  // from qualifications[0].fileUrl (auto-synced)
  } | null> {
    const profile = await this.getMemberProfile(uid);
    if (!profile) return null;
    return {
      email:              profile.email,
      firstName:          profile.firstName,
      lastName:           profile.lastName,
      phoneNumber:        profile.phoneNumber,
      dateOfBirth:        profile.dateOfBirth,
      gender:             profile.gender,
      address:            profile.address,
      qualificationTitle: profile.qualificationTitle,
      qualificationUrl:   profile.qualificationUrl,
    };
  }

  /** Full live member profile — used by GetRoleRequestByIdUseCase for admin review. */
  async getMemberProfile(uid: string): Promise<{
    uid:               string;
    email:             string;
    firstName:         string;
    lastName:          string;
    phoneNumber:       string | null;
    profilePhotoUrl:   string | null;
    dateOfBirth:       string | null;
    gender:            string | null;
    address:           string | null;
    preferredLanguage: string;
    roles:             string[];
    status:            string;
    accountCreatedAt:  string;
    qualifications:    { id: string; title: string; fileUrl: string | null }[];
    qualificationTitle: string | null;
    qualificationUrl:   string | null;
  } | null> {
    try {
      const res = await this.http.get<{
        uid:               string;
        email:             string;
        firstName:         string;
        lastName:          string;
        phoneNumber:       string | null;
        profilePhotoUrl:   string | null;
        dateOfBirth:       string | null;
        gender:            string | null;
        address:           string | null;
        preferredLanguage: string;
        roles:             string[];
        status:            string;
        accountCreatedAt:  string;
        qualifications:    { id: string; title: string; fileUrl: string | null }[];
        qualificationTitle: string | null;
        qualificationUrl:   string | null;
      }>(`/internal/users/${uid}`);
      const d = res.data;
      return {
        uid:               d.uid,
        email:             d.email,
        firstName:         d.firstName,
        lastName:          d.lastName,
        phoneNumber:       d.phoneNumber       ?? null,
        profilePhotoUrl:   d.profilePhotoUrl   ?? null,
        dateOfBirth:       d.dateOfBirth       ?? null,
        gender:            d.gender            ?? null,
        address:           d.address           ?? null,
        preferredLanguage: d.preferredLanguage ?? 'en',
        roles:             d.roles             ?? [],
        status:            d.status            ?? 'approved',
        accountCreatedAt:  d.accountCreatedAt  ?? '',
        qualifications:    d.qualifications    ?? [],
        qualificationTitle: d.qualificationTitle ?? null,
        qualificationUrl:   d.qualificationUrl   ?? null,
      };
    } catch {
      return null;
    }
  }
}