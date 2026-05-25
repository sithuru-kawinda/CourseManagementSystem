import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export interface InternalUser {
  uid:       string;
  email:     string;
  firstName: string;
  lastName:  string;
}

export class UserServiceClient {
  private readonly http = createInternalClient(config.serviceUserUrl, config.internalServiceKey);

  async getAdminUids(): Promise<string[]> {
    try {
      const res = await this.http.get<{ uids: string[] }>('/internal/users/admins');
      return res.data.uids;
    } catch {
      return [];
    }
  }

  /** Fetch a single user profile. Returns null on any error (fire-and-forget safe). */
  async getUserById(uid: string): Promise<InternalUser | null> {
    try {
      const res = await this.http.get<InternalUser>(`/internal/users/${uid}`);
      return res.data;
    } catch {
      return null;
    }
  }
}
