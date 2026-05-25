import { createHttpError }          from '@shared/errors';
import { OutboxEventPublisher }     from '@shared/events';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { IJoinRequestRepository }   from '../../domain/repositories/IJoinRequestRepository';
import { JoinRequest }              from '../../domain/entities/JoinRequest';

export class RejectJoinRequestUseCase {
  constructor(
    private readonly cellRepo: ICellGroupRepository,
    private readonly joinRepo: IJoinRequestRepository,
    private readonly outbox:   OutboxEventPublisher,
  ) {}

  async execute(
    cellId:      string,
    requestId_r: string,
    decidedByUid: string,
    note:        string | undefined,
    requestId:   string,
  ): Promise<JoinRequest> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const joinReq = await this.joinRepo.findById(cellId, requestId_r);
    if (!joinReq) throw createHttpError(404, 'JOIN_REQUEST_NOT_FOUND', 'Join request not found.');

    joinReq.reject(decidedByUid, note);
    await this.joinRepo.update(joinReq);

    await this.outbox.publishWithBatch({
      type:    'cell.join_rejected',
      payload: {
        cellId,
        cellName:      cell.name,
        requesterUid:  joinReq.requesterUid,
        joinRequestId: joinReq.id,
        decidedByUid,
      },
      requestId,
    });

    return joinReq;
  }
}
