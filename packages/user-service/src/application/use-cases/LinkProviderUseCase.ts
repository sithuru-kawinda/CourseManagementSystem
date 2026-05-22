import { createHttpError }   from '@shared/errors';
import { IUserRepository }   from '../../domain/repositories/IUserRepository';
import { AuthServiceClient } from '../../infrastructure/clients/AuthServiceClient';

export class LinkProviderUseCase {
  constructor(
    private readonly userRepo:    IUserRepository,
    private readonly authClient:  AuthServiceClient,
  ) {}

  async execute(uid: string, provider: 'google' | 'apple', idToken: string): Promise<string[]> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    // Verify the federated token via auth-service internal endpoint
    let payload: Awaited<ReturnType<typeof this.authClient.verifyFederatedToken>>;
    try {
      payload = await this.authClient.verifyFederatedToken(provider, idToken);
    } catch {
      throw createHttpError(401, 'INVALID_FEDERATED_TOKEN', 'Could not verify the federated identity token.');
    }

    // Confirm the token email matches the user's account (security check)
    if (payload.email.toLowerCase() !== user.email.toLowerCase()) {
      throw createHttpError(409, 'EMAIL_MISMATCH', 'The federated token email does not match your account email.');
    }

    if (user.providers.includes(payload.providerId)) {
      return user.providers; // already linked — idempotent
    }

    user.linkProvider(payload.providerId);
    await this.userRepo.update(user);
    return user.providers;
  }
}
