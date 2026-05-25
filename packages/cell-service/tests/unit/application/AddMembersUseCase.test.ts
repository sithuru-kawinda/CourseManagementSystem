import { AddMembersUseCase }     from '../../../src/application/use-cases/AddMembersUseCase';
import { ICellGroupRepository }  from '../../../src/domain/repositories/ICellGroupRepository';
import { CellGroup }             from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeCell = (members: string[] = ['leader-uid']): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test Cell', type: 'care', area: 'Area',
    leaderUid: 'leader-uid', g12LeaderUid: 'g12-uid',
    members, memberCount: members.length, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

describe('AddMembersUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let useCase: AddMembersUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new AddMembersUseCase(repo);
    repo.update.mockResolvedValue(undefined);
  });

  it('adds new members and returns added list', async () => {
    repo.findById.mockResolvedValue(makeCell(['leader-uid']));

    const result = await useCase.execute('cell-1', ['user-2', 'user-3'], 'leader-uid', ['leader']);

    expect(result.added).toEqual(['user-2', 'user-3']);
    expect(result.memberCount).toBe(3);
    expect(repo.update).toHaveBeenCalled();
  });

  it('skips already-existing members (idempotent)', async () => {
    repo.findById.mockResolvedValue(makeCell(['leader-uid', 'existing-uid']));

    const result = await useCase.execute('cell-1', ['existing-uid', 'new-uid'], 'leader-uid', ['leader']);

    expect(result.added).toEqual(['new-uid']);
    expect(result.memberCount).toBe(3);
  });

  it('does not call update when all members already exist', async () => {
    repo.findById.mockResolvedValue(makeCell(['leader-uid', 'user-a']));

    const result = await useCase.execute('cell-1', ['user-a'], 'leader-uid', ['leader']);

    expect(result.added).toEqual([]);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('admin can add members to any cell', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await useCase.execute('cell-1', ['new-uid'], 'admin-uid', ['admin']);

    expect(repo.update).toHaveBeenCalled();
  });

  it('throws 404 when cell does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad', ['uid'], 'leader-uid', ['leader']),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('throws 403 when non-owner non-admin tries to add members', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await expect(
      useCase.execute('cell-1', ['uid'], 'stranger', ['member']),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
    expect(repo.update).not.toHaveBeenCalled();
  });
});
