import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest }             from '@shared/auth-middleware';
import { fromZodError }                     from '@shared/errors';
import { sendSuccess, sendPaginated }       from '@shared/response';
import { CreateCellGroupUseCase }           from '../../application/use-cases/CreateCellGroupUseCase';
import { GetCellsUseCase }                  from '../../application/use-cases/GetCellsUseCase';
import { GetMyCellsUseCase }                from '../../application/use-cases/GetMyCellsUseCase';
import { GetCellByIdUseCase }               from '../../application/use-cases/GetCellByIdUseCase';
import { UpdateCellGroupUseCase }           from '../../application/use-cases/UpdateCellGroupUseCase';
import { ArchiveCellGroupUseCase }          from '../../application/use-cases/ArchiveCellGroupUseCase';
import { DeleteCellGroupUseCase }          from '../../application/use-cases/DeleteCellGroupUseCase';
import { TransferCellOwnershipUseCase }    from '../../application/use-cases/TransferCellOwnershipUseCase';
import { AddMembersUseCase }                from '../../application/use-cases/AddMembersUseCase';
import { RemoveMemberUseCase }              from '../../application/use-cases/RemoveMemberUseCase';
import { CreateJoinRequestUseCase }         from '../../application/use-cases/CreateJoinRequestUseCase';
import { GetJoinRequestsUseCase }           from '../../application/use-cases/GetJoinRequestsUseCase';
import { ApproveJoinRequestUseCase }        from '../../application/use-cases/ApproveJoinRequestUseCase';
import { RejectJoinRequestUseCase }         from '../../application/use-cases/RejectJoinRequestUseCase';
import {
  createCellSchema, updateCellSchema, addMembersSchema,
  createJoinRequestSchema, decideJoinRequestSchema,
  listCellsSchema, listJoinRequestsSchema, transferOwnershipSchema,
} from '../validators/cellValidator';

export class CellGroupController {
  constructor(
    private readonly createUC:        CreateCellGroupUseCase,
    private readonly getCellsUC:      GetCellsUseCase,
    private readonly getMyCellsUC:    GetMyCellsUseCase,
    private readonly getCellByIdUC:   GetCellByIdUseCase,
    private readonly updateUC:        UpdateCellGroupUseCase,
    private readonly archiveUC:       ArchiveCellGroupUseCase,
    private readonly deleteUC:        DeleteCellGroupUseCase,
    private readonly transferUC:      TransferCellOwnershipUseCase,
    private readonly addMembersUC:    AddMembersUseCase,
    private readonly removeMemberUC:  RemoveMemberUseCase,
    private readonly createJoinUC:    CreateJoinRequestUseCase,
    private readonly getJoinUC:       GetJoinRequestsUseCase,
    private readonly approveJoinUC:   ApproveJoinRequestUseCase,
    private readonly rejectJoinUC:    RejectJoinRequestUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listCellsSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.getCellsUC.execute(parsed.data, uid, roles);
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  mine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      const cells   = await this.getMyCellsUC.execute(uid);
      sendSuccess(res, cells);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createCellSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const cell = await this.createUC.execute({ ...parsed.data, leaderUid: uid }, requestId);
      sendSuccess(res, cell, 201);
    } catch (err) { next(err); }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const cell = await this.getCellByIdUC.execute(req.params.id, uid, roles);
      sendSuccess(res, cell);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateCellSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const cell = await this.updateUC.execute(req.params.id, parsed.data, uid, roles);
      sendSuccess(res, cell);
    } catch (err) { next(err); }
  };

  archive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const cell = await this.archiveUC.execute(req.params.id, uid, roles);
      sendSuccess(res, cell);
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      await this.deleteUC.execute(req.params.id, uid, roles);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  transferOwnership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = transferOwnershipSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const requestId      = (req.headers['x-request-id'] as string) ?? '';
      const cell = await this.transferUC.execute(req.params.id, parsed.data, uid, roles, requestId);
      sendSuccess(res, cell);
    } catch (err) { next(err); }
  };

  addMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = addMembersSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.addMembersUC.execute(req.params.id, parsed.data.userUids, uid, roles);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.removeMemberUC.execute(req.params.id, req.params.uid, uid, roles);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  createJoinRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createJoinRequestSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const joinReq = await this.createJoinUC.execute(req.params.id, uid, parsed.data.message ?? null, requestId);
      sendSuccess(res, joinReq, 201);
    } catch (err) { next(err); }
  };

  listJoinRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listJoinRequestsSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.getJoinUC.execute(req.params.id, parsed.data, uid, roles);
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  approveJoinRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = decideJoinRequestSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const result = await this.approveJoinUC.execute(req.params.id, req.params.rid, uid, parsed.data.note, requestId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  rejectJoinRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = decideJoinRequestSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const result = await this.rejectJoinUC.execute(req.params.id, req.params.rid, uid, parsed.data.note, requestId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };
}
