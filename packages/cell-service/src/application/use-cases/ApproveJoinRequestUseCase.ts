import { createHttpError }          from '@shared/errors';
import { OutboxEventPublisher }     from '@shared/events';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { IJoinRequestRepository }   from '../../domain/repositories/IJoinRequestRepository';

export interface ApproveJoinRequestResult {
  joinRequestId: string;
  memberUid:     string;
  memberCount:   number;
  message:       string;
}

export class ApproveJoinRequestUseCase {
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
  ): Promise<ApproveJoinRequestResult> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const joinReq = await this.joinRepo.findById(cellId, requestId_r);
    if (!joinReq) throw createHttpError(404, 'JOIN_REQUEST_NOT_FOUND', 'Join request not found.');

    joinReq.approve(decidedByUid, note);
    cell.addMembers([joinReq.requesterUid]);

    await this.joinRepo.update(joinReq);
    await this.cellRepo.update(cell);

    await this.outbox.publishWithBatch({
      type:    'cell.join_approved',
      payload: {
        cellId,
        cellName:  cell.name,
        memberUid: joinReq.requesterUid,
        joinRequestId: joinReq.id,
        decidedByUid,
      },
      requestId,
    });

    return {
      joinRequestId: joinReq.id,
      memberUid:     joinReq.requesterUid,
      memberCount:   cell.memberCount,
      message:       'Member added to cell group.',
    };
  }
}
