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

  async getUser(uid: string): Promise<{ email: string; firstName: string; lastName: string } | null> {
    try {
      const res = await this.http.get<{ uid: string; email: string; firstName: string; lastName: string }>(
        `/internal/users/${uid}`,
      );
      return { email: res.data.email, firstName: res.data.firstName, lastName: res.data.lastName };
    } catch {
      return null;
    }
  }
}