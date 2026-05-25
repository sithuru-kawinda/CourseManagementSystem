import { ApproveJoinRequestUseCase } from '../../../src/application/use-cases/ApproveJoinRequestUseCase';
import { ICellGroupRepository }       from '../../../src/domain/repositories/ICellGroupRepository';
import { IJoinRequestRepository }     from '../../../src/domain/repositories/IJoinRequestRepository';
import { OutboxEventPublisher }       from '@shared/events';
import { CellGroup }                  from '../../../src/domain/entities/CellGroup';
import { JoinRequest }                from '../../../src/domain/entities/JoinRequest';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});
const makeJoinRepo = (): jest.Mocked<IJoinRequestRepository> => ({
  findById: jest.fn(), findPendingByRequester: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(),
});
const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeCell = (): CellGroup => new CellGroup({
  id: 'cell-1', name: 'Test', type: 'g12', area: 'Area',
  leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
  members: ['leader-1'], memberCount: 1, reportCount: 0,
  state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});

const makeJoinReq = (status: 'pending' | 'approved' | 'rejected' = 'pending'): JoinRequest =>
  new JoinRequest({
    id: 'req-1', cellId: 'cell-1', requesterUid: 'member-uid',
    message: null, status, decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00Z', decidedAt: null,
  });

describe('ApproveJoinRequestUseCase', () => {
  let cellRepo: jest.Mocked<ICellGroupRepository>;
  let joinRepo: jest.Mocked<IJoinRequestRepository>;
  let outbox:   jest.Mocked<OutboxEventPublisher>;
  let useCase:  ApproveJoinRequestUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo = makeRepo();
    joinRepo = makeJoinRepo();
    outbox   = makeOutbox();
    useCase  = new ApproveJoinRequestUseCase(cellRepo, joinRepo, outbox);
  });

  it('approves join request, adds member, publishes cell.join_approved', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findById.mockResolvedValue(makeJoinReq('pending'));
    joinRepo.update.mockResolvedValue(undefined);
    cellRepo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('cell-1', 'req-1', 'admin-uid', 'Welcome!', 'http-1');

    expect(result.memberUid).toBe('member-uid');
    expect(result.memberCount).toBe(2);
    expect(result.message).toBe('Member added to cell group.');
    expect(joinRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cell.join_approved' }),
    );
  });

  it('throws 404 when cell not found', async () => {
    cellRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad', 'req-1', 'admin', undefined, 'r')).rejects.toMatchObject({
      status: 404, errorCode: 'CELL_NOT_FOUND',
    });
  });

  it('throws 404 when join request not found', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('cell-1', 'bad-req', 'admin', undefined, 'r')).rejects.toMatchObject({
      status: 404, errorCode: 'JOIN_REQUEST_NOT_FOUND',
    });
  });

  it('throws 409 INVALID_STATE when request already approved', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findById.mockResolvedValue(makeJoinReq('approved'));

    await expect(useCase.execute('cell-1', 'req-1', 'admin', undefined, 'r')).rejects.toMatchObject({
      status: 409, errorCode: 'INVALID_STATE',
    });
  });
});
