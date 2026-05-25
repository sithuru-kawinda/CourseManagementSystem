import { Request, Response, NextFunction } from 'express';
import { fromZodError }                    from '@shared/errors';
import { sendSuccess }                     from '@shared/response';
import { CheckEmailExistsUseCase }         from '../../application/use-cases/CheckEmailExistsUseCase';
import { AddRoleUseCase }                  from '../../application/use-cases/AddRoleUseCase';
import { RemoveRoleUseCase }               from '../../application/use-cases/RemoveRoleUseCase';
import { ApproveUserUseCase }              from '../../application/use-cases/ApproveUserUseCase';
import { GetUsersUseCase }                 from '../../application/use-cases/GetUsersUseCase';
import { GetUserByIdUseCase }              from '../../application/use-cases/GetUserByIdUseCase';
import { checkEmailSchema, approveUserSchema, addRoleSchema, removeRoleSchema } from '../validators/internalValidator';

export class InternalController {
  constructor(
    private readonly checkEmail:       CheckEmailExistsUseCase,
    private readonly approveUser:      ApproveUserUseCase,
    private readonly getUsers:         GetUsersUseCase,
    private readonly addRoleUseCase:   AddRoleUseCase,
    private readonly removeRoleUseCase: RemoveRoleUseCase,
    private readonly getUserById:      GetUserByIdUseCase,
  ) {}

  exists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = checkEmailSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const result = await this.checkEmail.execute(parsed.data.email);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = approveUserSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      await this.approveUser.execute(parsed.data.uid);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  getAdmins = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getUsers.execute({ limit: 100, role: 'admin' });
      sendSuccess(res, { uids: result.items.map(u => u.uid) });
    } catch (err) { next(err); }
  };

  addRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = addRoleSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      await this.addRoleUseCase.execute(parsed.data.uid, parsed.data.role);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  // POST /internal/users/remove-role — called by outbox-worker after cell ownership transfer
  // Removes a role from a user (idempotent — no error if user doesn't have the role)
  removeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = removeRoleSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      await this.removeRoleUseCase.execute(parsed.data.uid, parsed.data.role);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  // GET /internal/users/:uid — returns full member profile for internal callers
  // Used by enrollment-service to: (1) enrich approval email payload, (2) build
  // the live memberProfile block in GET /role-requests/:id for admin review.
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.getUserById.execute(req.params.uid);
      sendSuccess(res, {
        uid:               user.uid,
        email:             user.email,
        firstName:         user.firstName,
        lastName:          user.lastName,
        phoneNumber:       user.phoneNumber,
        profilePhotoUrl:   user.profilePhotoUrl,
        dateOfBirth:       user.dateOfBirth,
        gender:            user.gender,
        address:           user.address,
        preferredLanguage: user.preferredLanguage,
        roles:             user.roles,
        status:            user.status,
        accountCreatedAt:  user.createdAt,
        qualifications:    user.qualifications,
        // Legacy single fields kept for backward compat
        qualificationTitle: user.qualificationTitle,
        qualificationUrl:   user.qualificationUrl,
      });
    } catch (err) { next(err); }
  };
}