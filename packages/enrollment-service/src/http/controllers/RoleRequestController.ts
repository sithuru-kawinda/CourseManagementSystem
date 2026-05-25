import { Request, Response, NextFunction }          from 'express';
import { AuthenticatedRequest }                       from '@shared/auth-middleware';
import { fromZodError }                               from '@shared/errors';
import { sendSuccess, sendPaginated }                 from '@shared/response';
import { CreateRoleRequestUseCase }                  from '../../application/use-cases/CreateRoleRequestUseCase';
import { ApproveRoleRequestUseCase }                 from '../../application/use-cases/ApproveRoleRequestUseCase';
import { RejectRoleRequestUseCase }                  from '../../application/use-cases/RejectRoleRequestUseCase';
import { GetRoleRequestsUseCase }                    from '../../application/use-cases/GetRoleRequestsUseCase';
import { GetMyRoleRequestsUseCase }                  from '../../application/use-cases/GetMyRoleRequestsUseCase';
import { GetRoleRequestQualificationUseCase }        from '../../application/use-cases/GetRoleRequestQualificationUseCase';
import { GetRoleRequestByIdUseCase }                 from '../../application/use-cases/GetRoleRequestByIdUseCase';
import {
  createRoleRequestSchema,
  decideRoleRequestSchema,
  listRoleRequestsSchema,
} from '../validators/roleRequestValidator';

export class RoleRequestController {
  constructor(
    private readonly createUseCase:        CreateRoleRequestUseCase,
    private readonly approveUseCase:       ApproveRoleRequestUseCase,
    private readonly rejectUseCase:        RejectRoleRequestUseCase,
    private readonly listUseCase:          GetRoleRequestsUseCase,
    private readonly myListUseCase:        GetMyRoleRequestsUseCase,
    private readonly qualificationUseCase: GetRoleRequestQualificationUseCase,
    private readonly getByIdUseCase:       GetRoleRequestByIdUseCase,
  ) {}

  // Member: POST /role-requests  — body: { requestedRole: "student" }
  // Profile data is read automatically from the member's existing profile
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createRoleRequestSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const { uid }   = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';

      const result = await this.createUseCase.execute(
        { requesterUid: uid, requestedRole: 'student' },
        requestId,
      );

      sendSuccess(res, result, 201);
    } catch (err) { next(err); }
  };

  // Member: GET /role-requests/mine
  mine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      const items   = await this.myListUseCase.execute(uid);
      sendSuccess(res, items);
    } catch (err) { next(err); }
  };

  // Admin: GET /role-requests
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listRoleRequestsSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const result = await this.listUseCase.execute(parsed.data);
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  // GET /role-requests/:id
  // Admin / super_admin: see any request + live memberProfile block.
  // Member (or any other non-admin role): can only see their own request — 403 for others.
  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const isAdmin = roles.includes('admin') || roles.includes('super_admin');

      const detail = await this.getByIdUseCase.execute({
        id:           req.params.id,
        requesterUid: uid,
        isAdmin,
      });

      sendSuccess(res, detail);
    } catch (err) { next(err); }
  };

  // Admin: GET /role-requests/:id/qualification  → 15-min signed URL
  getQualification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.qualificationUseCase.execute(req.params.id);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  // Admin: POST /role-requests/:id/approve
  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = decideRoleRequestSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const { uid } = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const result = await this.approveUseCase.execute(req.params.id, uid, parsed.data.note, requestId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  // Admin: POST /role-requests/:id/reject
  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = decideRoleRequestSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const { uid } = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const result = await this.rejectUseCase.execute(req.params.id, uid, parsed.data.note, requestId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };
}
