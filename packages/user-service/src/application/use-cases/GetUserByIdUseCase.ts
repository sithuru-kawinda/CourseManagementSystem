import { createHttpError } from '@shared/errors';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User }            from '../../domain/entities/User';
import { Role }            from '@shared/auth-middleware';

export class GetUserByIdUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(uid: string, callerRoles: Role[] = []): Promise<User> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    // Leaders and G12 get a scoped view — they cannot look up admin or super_admin profiles
    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    if (!isAdmin) {
      const targetIsAdmin =
        (user.roles ?? []).includes('admin') || (user.roles ?? []).includes('super_admin');
      if (targetIsAdmin) throw createHttpError(403, 'FORBIDDEN', 'Insufficient permissions.');
    }

    return user;
  }
}
