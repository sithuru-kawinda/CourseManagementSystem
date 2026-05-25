import { RemoveMemberUseCase }   from '../../../src/application/use-cases/RemoveMemberUseCase';
import { ICellGroupRepository }  from '../../../src/domain/repositories/ICellGroupRepository';
import { CellGroup }             from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeCell = (members: string[] = ['leader-uid', 'member-uid']): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test Cell', type: 'care', area: 'Area',
    leaderUid: 'leader-uid', g12LeaderUid: 'g12-uid',
    members, memberCount: members.length, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

describe('RemoveMemberUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let useCase: RemoveMemberUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new RemoveMemberUseCase(repo);
    repo.update.mockResolvedValue(undefined);
  });

  it('removes member and returns updated memberCount', async () => {
    repo.findById.mockResolvedValue(makeCell(['leader-uid', 'member-uid']));

    const result = await useCase.execute('cell-1', 'member-uid', 'leader-uid', ['leader']);

    expect(result.removed).toBe('member-uid');
    expect(result.memberCount).toBe(1);
    expect(repo.update).toHaveBeenCalled();
  });

  it('admin can remove any member', async () => {
    repo.findById.mockResolvedValue(makeCell(['leader-uid', 'member-uid']));

    const result = await useCase.execute('cell-1', 'member-uid', 'admin-uid', ['admin']);

    expect(result.removed).toBe('member-uid');
  });

  it('throws 404 when cell does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad', 'uid', 'leader-uid', ['leader']),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('throws 403 when non-owner non-admin tries to remove a member', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await expect(
      useCase.execute('cell-1', 'member-uid', 'stranger', ['member']),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 404 from entity when uid is not a member of the cell', async () => {
    repo.findById.mockResolvedValue(makeCell(['leader-uid']));

    await expect(
      useCase.execute('cell-1', 'non-member-uid', 'leader-uid', ['leader']),
    ).rejects.toMatchObject({ status: 404, errorCode: 'MEMBER_NOT_FOUND' });
  });
});
