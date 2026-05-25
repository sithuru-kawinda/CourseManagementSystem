import { Request, Response, NextFunction } from 'express';
import { fromZodError }                    from '@shared/errors';
import { sendSuccess, sendPaginated }      from '@shared/response';
import { AuthenticatedRequest }            from '@shared/auth-middleware';
import { GetUsersUseCase }                 from '../../application/use-cases/GetUsersUseCase';
import { GetUserByIdUseCase }              from '../../application/use-cases/GetUserByIdUseCase';
import { SuspendUserUseCase }             from '../../application/use-cases/SuspendUserUseCase';
import { ReactivateUserUseCase }          from '../../application/use-cases/ReactivateUserUseCase';
import { AddRoleUseCase }                 from '../../application/use-cases/AddRoleUseCase';
import { RemoveRoleUseCase }              from '../../application/use-cases/RemoveRoleUseCase';
import { CreateUserDirectlyUseCase }      from '../../application/use-cases/CreateUserDirectlyUseCase';
import { PromoteMemberUseCase }           from '../../application/use-cases/PromoteMemberUseCase';
import { DemoteMemberUseCase }           from '../../application/use-cases/DemoteMemberUseCase';
import { DeleteUserUseCase }              from '../../application/use-cases/DeleteUserUseCase';
import { listUsersSchema, assignRoleSchema, createUserDirectlySchema, promoteMemberSchema, demoteMemberSchema } from '../validators/userValidator';
import { TtlCache }                       from '../../infrastructure/cache/TtlCache';
import { FindAllResult }                  from '../../domain/repositories/IUserRepository';

export class UsersController {
  constructor(
    private readonly getUsersUseCase:           GetUsersUseCase,
    private readonly getUserByIdUseCase:        GetUserByIdUseCase,
    private readonly suspendUserUseCase:        SuspendUserUseCase,
    private readonly reactivateUseCase:         ReactivateUserUseCase,
    private readonly addRoleUseCase:            AddRoleUseCase,
    private readonly removeRoleUseCase:         RemoveRoleUseCase,
    private readonly createUserDirectlyUseCase: CreateUserDirectlyUseCase,
    private readonly promoteMemberUseCase:      PromoteMemberUseCase,
    private readonly demoteMemberUseCase:       DemoteMemberUseCase,
    private readonly deleteUserUseCase:         DeleteUserUseCase,
  ) {}

  private static readonly listCache = new TtlCache<FindAllResult>(30_000);

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listUsersSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const callerRoles = (req as AuthenticatedRequest).principal?.roles ?? [];
      const cacheKey    = JSON.stringify({ ...parsed.data, _roles: [...callerRoles].sort().join(',') });
      const cached      = UsersController.listCache.get(cacheKey);
      if (cached) return sendPaginated(res, cached.items, cached.nextCursor, cached.total);

      const result = await this.getUsersUseCase.execute(parsed.data, callerRoles);
      UsersController.listCache.set(cacheKey, result);
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerRoles = (req as AuthenticatedRequest).principal?.roles ?? [];
      const user = await this.getUserByIdUseCase.execute(req.params.uid, callerRoles);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  suspend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const user      = await this.suspendUserUseCase.execute(req.params.uid, requestId);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.reactivateUseCase.execute(req.params.uid);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  // DELETE /users/:uid — admin soft-deletes a regular (non-admin) user
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerUid = (req as AuthenticatedRequest).principal.uid;
      await this.deleteUserUseCase.execute({ targetUid: req.params.uid, callerUid });
      UsersController.listCache.clear();
      res.status(204).send();
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createUserDirectlySchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const user = await this.createUserDirectlyUseCase.execute(parsed.data, requestId);
      sendSuccess(res, user, 201);
    } catch (err) { next(err); }
  };

  assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = assignRoleSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      if (parsed.data.action === 'add') {
        await this.addRoleUseCase.execute(req.params.uid, parsed.data.role);
      } else {
        await this.removeRoleUseCase.execute(req.params.uid, parsed.data.role);
      }
      res.status(204).send();
    } catch (err) { next(err); }
  };

  /**
   * POST /users/:uid/promote
   * Authorized for g12, admin, super_admin.
   * Allows a G12 leader to promote a member or leader to 'leader' or 'g12'.
   */
  promote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = promoteMemberSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const principal  = (req as AuthenticatedRequest).principal;
      const requestId  = (req.headers['x-request-id'] as string) ?? '';

      await this.promoteMemberUseCase.execute({
        targetUid:   req.params.uid,
        role:         parsed.data.role,
        callerUid:   principal.uid,
        callerRoles: principal.roles,
        requestId,
      });

      res.status(204).send();
    } catch (err) { next(err); }
  };

  /**
   * POST /users/:uid/demote
   * Remove a role from a user and revert them to their remaining roles.
   * Dual-writes Firestore roles[] + Firebase Auth custom claims.
   * Caller-role permissions:
   *   super_admin / admin → can demote student / leader / g12
   *   g12                 → can demote leader / g12
   *   leader              → can demote g12 only
   */
  demote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = demoteMemberSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const principal = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';

      await this.demoteMemberUseCase.execute({
        targetUid:   req.params.uid,
        role:        parsed.data.role,
        callerUid:   principal.uid,
        callerRoles: principal.roles,
        requestId,
      });

      UsersController.listCache.clear();
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
