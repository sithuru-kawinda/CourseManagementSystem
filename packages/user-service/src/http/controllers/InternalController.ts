import { Request, Response, NextFunction } from 'express';
import { fromZodError }                    from '@shared/errors';
import { sendSuccess }                     from '@shared/response';
import { CheckEmailExistsUseCase }         from '../../application/use-cases/CheckEmailExistsUseCase';
import { AddRoleUseCase }                  from '../../application/use-cases/AddRoleUseCase';
import { ApproveUserUseCase }              from '../../application/use-cases/ApproveUserUseCase';
import { GetUsersUseCase }                 from '../../application/use-cases/GetUsersUseCase';
import { GetUserByIdUseCase }              from '../../application/use-cases/GetUserByIdUseCase';
import { checkEmailSchema, approveUserSchema, addRoleSchema } from '../validators/internalValidator';

export class InternalController {
  constructor(
    private readonly checkEmail:    CheckEmailExistsUseCase,
    private readonly approveUser:   ApproveUserUseCase,
    private readonly getUsers:      GetUsersUseCase,
    private readonly addRoleUseCase: AddRoleUseCase,
    private readonly getUserById:   GetUserByIdUseCase,
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

  // GET /internal/users/:uid — used by enrollment-service to enrich approval email payload
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.getUserById.execute(req.params.uid);
      sendSuccess(res, { uid: user.uid, email: user.email, firstName: user.firstName, lastName: user.lastName });
    } catch (err) { next(err); }
  };
}