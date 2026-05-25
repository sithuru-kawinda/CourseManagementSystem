import { RejectJoinRequestUseCase } from '../../../src/application/use-cases/RejectJoinRequestUseCase';
import { ICellGroupRepository }      from '../../../src/domain/repositories/ICellGroupRepository';
import { IJoinRequestRepository }    from '../../../src/domain/repositories/IJoinRequestRepository';
import { OutboxEventPublisher }      from '@shared/events';
import { CellGroup }                 from '../../../src/domain/entities/CellGroup';
import { JoinRequest }               from '../../../src/domain/entities/JoinRequest';

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

const makeCell = (): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test', type: 'care', area: 'Area',
    leaderUid: 'leader-uid', g12LeaderUid: 'g12-uid',
    members: ['leader-uid'], memberCount: 1, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

const makeJoinReq = (status: 'pending' | 'approved' | 'rejected' = 'pending'): JoinRequest =>
  new JoinRequest({
    id: 'req-1', cellId: 'cell-1', requesterUid: 'member-uid',
    message: null, status, decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00Z', decidedAt: null,
  });

describe('RejectJoinRequestUseCase', () => {
  let cellRepo: jest.Mocked<ICellGroupRepository>;
  let joinRepo: jest.Mocked<IJoinRequestRepository>;
  let outbox:   jest.Mocked<OutboxEventPublisher>;
  let useCase:  RejectJoinRequestUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo = makeRepo();
    joinRepo = makeJoinRepo();
    outbox   = makeOutbox();
    useCase  = new RejectJoinRequestUseCase(cellRepo, joinRepo, outbox);
    joinRepo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
  });

  it('rejects a pending join request and publishes cell.join_rejected', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findById.mockResolvedValue(makeJoinReq('pending'));

    const result = await useCase.execute('cell-1', 'req-1', 'admin-uid', 'Not eligible', 'req-id');

    expect(result.status).toBe('rejected');
    expect(result.decidedByUid).toBe('admin-uid');
    expect(result.decisionNote).toBe('Not eligible');
    expect(joinRepo.update).toHaveBeenCalledWith(result);
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cell.join_rejected' }),
    );
  });

  it('rejects without a note', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findById.mockResolvedValue(makeJoinReq('pending'));

    const result = await useCase.execute('cell-1', 'req-1', 'admin-uid', undefined, 'req-id');

    expect(result.status).toBe('rejected');
  });

  it('throws 404 when cell does not exist', async () => {
    cellRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad', 'req-1', 'admin-uid', undefined, 'r'),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('throws 404 when join request does not exist', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('cell-1', 'bad-req', 'admin-uid', undefined, 'r'),
    ).rejects.toMatchObject({ status: 404, errorCode: 'JOIN_REQUEST_NOT_FOUND' });
  });

  it('throws 409 INVALID_STATE when request is already rejected', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findById.mockResolvedValue(makeJoinReq('rejected'));

    await expect(
      useCase.execute('cell-1', 'req-1', 'admin-uid', undefined, 'r'),
    ).rejects.toMatchObject({ status: 409, errorCode: 'INVALID_STATE' });
    expect(joinRepo.update).not.toHaveBeenCalled();
  });

  it('throws 409 INVALID_STATE when request is already approved', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findById.mockResolvedValue(makeJoinReq('approved'));

    await expect(
      useCase.execute('cell-1', 'req-1', 'admin-uid', undefined, 'r'),
    ).rejects.toMatchObject({ status: 409, errorCode: 'INVALID_STATE' });
  });
});
