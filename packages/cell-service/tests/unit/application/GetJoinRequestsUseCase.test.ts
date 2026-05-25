import { GetJoinRequestsUseCase } from '../../../src/application/use-cases/GetJoinRequestsUseCase';
import { ICellGroupRepository }    from '../../../src/domain/repositories/ICellGroupRepository';
import { IJoinRequestRepository }  from '../../../src/domain/repositories/IJoinRequestRepository';
import { CellGroup }               from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});
const makeJoinRepo = (): jest.Mocked<IJoinRequestRepository> => ({
  findById: jest.fn(), findPendingByRequester: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(),
});

const makeCell = (leaderUid = 'leader-uid'): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test', type: 'care', area: 'Area',
    leaderUid, g12LeaderUid: 'g12-uid',
    members: [leaderUid], memberCount: 1, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

const EMPTY_LIST = { items: [], nextCursor: null, total: 0 };

describe('GetJoinRequestsUseCase', () => {
  let cellRepo: jest.Mocked<ICellGroupRepository>;
  let joinRepo: jest.Mocked<IJoinRequestRepository>;
  let useCase:  GetJoinRequestsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo = makeRepo();
    joinRepo = makeJoinRepo();
    useCase  = new GetJoinRequestsUseCase(cellRepo, joinRepo);
    joinRepo.findAll.mockResolvedValue(EMPTY_LIST);
  });

  it('owner (leader) can list join requests', async () => {
    cellRepo.findById.mockResolvedValue(makeCell('leader-uid'));

    await useCase.execute('cell-1', { limit: 20 }, 'leader-uid', ['leader']);

    expect(joinRepo.findAll).toHaveBeenCalledWith('cell-1', expect.any(Object));
  });

  it('admin can list join requests for any cell', async () => {
    cellRepo.findById.mockResolvedValue(makeCell('leader-uid'));

    await useCase.execute('cell-1', { limit: 20 }, 'admin-uid', ['admin']);

    expect(joinRepo.findAll).toHaveBeenCalled();
  });

  it('defaults status to pending when not specified', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());

    await useCase.execute('cell-1', { limit: 20 }, 'leader-uid', ['leader']);

    expect(joinRepo.findAll).toHaveBeenCalledWith(
      'cell-1',
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('passes through explicit status filter', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());

    await useCase.execute('cell-1', { limit: 20, status: 'approved' }, 'leader-uid', ['leader']);

    expect(joinRepo.findAll).toHaveBeenCalledWith(
      'cell-1',
      expect.objectContaining({ status: 'approved' }),
    );
  });

  it('throws 404 when cell does not exist', async () => {
    cellRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad', { limit: 20 }, 'leader-uid', ['leader']),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('throws 403 when non-owner non-admin tries to list requests', async () => {
    cellRepo.findById.mockResolvedValue(makeCell('other-leader'));

    await expect(
      useCase.execute('cell-1', { limit: 20 }, 'stranger', ['member']),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
    expect(joinRepo.findAll).not.toHaveBeenCalled();
  });
});
