import { CreateJoinRequestUseCase } from '../../../src/application/use-cases/CreateJoinRequestUseCase';
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

const makeCell = (state: 'active' | 'archived' = 'active'): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test', type: 'care', area: 'Area',
    leaderUid: 'leader-uid', g12LeaderUid: 'g12-uid',
    members: ['leader-uid'], memberCount: 1, reportCount: 0,
    state, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

const makePendingReq = (): JoinRequest =>
  new JoinRequest({
    id: 'req-existing', cellId: 'cell-1', requesterUid: 'member-uid',
    message: null, status: 'pending', decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00Z', decidedAt: null,
  });

describe('CreateJoinRequestUseCase', () => {
  let cellRepo: jest.Mocked<ICellGroupRepository>;
  let joinRepo: jest.Mocked<IJoinRequestRepository>;
  let outbox:   jest.Mocked<OutboxEventPublisher>;
  let useCase:  CreateJoinRequestUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo = makeRepo();
    joinRepo = makeJoinRepo();
    outbox   = makeOutbox();
    useCase  = new CreateJoinRequestUseCase(cellRepo, joinRepo, outbox);
    joinRepo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
  });

  it('creates a join request and publishes cell.join_requested', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findPendingByRequester.mockResolvedValue(null);

    const result = await useCase.execute('cell-1', 'member-uid', 'Hello!', 'req-id');

    expect(result.cellId).toBe('cell-1');
    expect(result.requesterUid).toBe('member-uid');
    expect(result.status).toBe('pending');
    expect(result.message).toBe('Hello!');
    expect(result.id).toBeDefined();
    expect(joinRepo.create).toHaveBeenCalledWith(result);
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cell.join_requested' }),
    );
  });

  it('creates join request with null message', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findPendingByRequester.mockResolvedValue(null);

    const result = await useCase.execute('cell-1', 'member-uid', null, 'req-id');

    expect(result.message).toBeNull();
  });

  it('generates unique IDs for each request', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findPendingByRequester.mockResolvedValue(null);

    const a = await useCase.execute('cell-1', 'uid-a', null, 'r1');
    const b = await useCase.execute('cell-1', 'uid-b', null, 'r2');

    expect(a.id).not.toBe(b.id);
  });

  it('throws 404 when cell does not exist', async () => {
    cellRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad', 'uid', null, 'r')).rejects.toMatchObject({
      status: 404, errorCode: 'CELL_NOT_FOUND',
    });
  });

  it('throws 409 INVALID_STATE when cell is archived', async () => {
    cellRepo.findById.mockResolvedValue(makeCell('archived'));

    await expect(useCase.execute('cell-1', 'uid', null, 'r')).rejects.toMatchObject({
      status: 409, errorCode: 'INVALID_STATE',
    });
  });

  it('throws 409 CELL_JOIN_REQUEST_PENDING when requester already has a pending request', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    joinRepo.findPendingByRequester.mockResolvedValue(makePendingReq());

    await expect(useCase.execute('cell-1', 'member-uid', null, 'r')).rejects.toMatchObject({
      status: 409, errorCode: 'CELL_JOIN_REQUEST_PENDING',
    });
    expect(joinRepo.create).not.toHaveBeenCalled();
  });
});
