import { v4 as uuidv4 }            from 'uuid';
import { createHttpError }          from '@shared/errors';
import { OutboxEventPublisher }     from '@shared/events';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { IJoinRequestRepository }   from '../../domain/repositories/IJoinRequestRepository';
import { JoinRequest }              from '../../domain/entities/JoinRequest';

export class CreateJoinRequestUseCase {
  constructor(
    private readonly cellRepo:    ICellGroupRepository,
    private readonly joinRepo:    IJoinRequestRepository,
    private readonly outbox:      OutboxEventPublisher,
  ) {}

  async execute(cellId: string, requesterUid: string, message: string | null, requestId: string): Promise<JoinRequest> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');
    if (cell.state === 'archived') {
      throw createHttpError(409, 'INVALID_STATE', 'Cannot apply to join an archived cell group.');
    }

    const existing = await this.joinRepo.findPendingByRequester(cellId, requesterUid);
    if (existing) {
      throw createHttpError(409, 'CELL_JOIN_REQUEST_PENDING', 'You already have a pending join request for this cell.');
    }

    const now = new Date().toISOString();
    const req = new JoinRequest({
      id:           uuidv4(),
      cellId,
      requesterUid,
      message,
      status:       'pending',
      decidedByUid: null,
      decisionNote: null,
      createdAt:    now,
      decidedAt:    null,
    });

    await this.joinRepo.create(req);

    await this.outbox.publishWithBatch({
      type:    'cell.join_requested',
      payload: {
        cellId,
        cellName:     cell.name,
        leaderUid:    cell.leaderUid,
        g12LeaderUid: cell.g12LeaderUid,
        requesterUid,
        joinRequestId: req.id,
      },
      requestId,
    });

    return req;
  }
}
