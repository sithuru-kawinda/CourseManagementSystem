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
    try {
      const res = await this.http.get<{
        uid:                  string;
        email:                string;
        firstName:            string;
        lastName:             string;
        phoneNumber:          string | null;
        dateOfBirth:          string | null;
        gender:               string | null;
        address:              string | null;
        qualificationTitle:   string | null;
        qualificationUrl:     string | null;
        qualifications?:      { id: string; title: string; fileUrl: string | null }[];
      }>(`/internal/users/${uid}`);
      const d = res.data;
      // Prefer qualifications array if present; fall back to legacy single fields
      const q0 = d.qualifications?.[0] ?? null;
      return {
        email:              d.email,
        firstName:          d.firstName,
        lastName:           d.lastName,
        phoneNumber:        d.phoneNumber        ?? null,
        dateOfBirth:        d.dateOfBirth        ?? null,
        gender:             d.gender             ?? null,
        address:            d.address            ?? null,
        qualificationTitle: q0?.title    ?? d.qualificationTitle ?? null,
        qualificationUrl:   q0?.fileUrl  ?? d.qualificationUrl   ?? null,
      };
    } catch {
      return null;
    }
  }
}