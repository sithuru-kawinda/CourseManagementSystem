import { GetCellByIdUseCase }    from '../../../src/application/use-cases/GetCellByIdUseCase';
import { ICellGroupRepository }  from '../../../src/domain/repositories/ICellGroupRepository';
import { UserServiceClient }     from '../../../src/infrastructure/clients/UserServiceClient';
import { CellGroup }             from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeUserClient = (): jest.Mocked<UserServiceClient> => ({
  getMemberProfiles: jest.fn().mockResolvedValue([
    { uid: 'leader-uid', firstName: 'Leader', lastName: 'One', displayName: 'Leader One' },
    { uid: 'member-uid', firstName: 'Member', lastName: 'Two', displayName: 'Member Two' },
  ]),
} as unknown as jest.Mocked<UserServiceClient>);

const makeCell = (overrides: Partial<{ leaderUid: string; members: string[] }> = {}): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test Cell', type: 'g12', area: 'Area',
    leaderUid:    overrides.leaderUid ?? 'leader-uid',
    g12LeaderUid: 'g12-uid',
    members:      overrides.members  ?? ['leader-uid', 'member-uid'],
    memberCount:  (overrides.members ?? ['leader-uid', 'member-uid']).length,
    reportCount: 0, state: 'active',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

describe('GetCellByIdUseCase', () => {
  let repo:       jest.Mocked<ICellGroupRepository>;
  let userClient: jest.Mocked<UserServiceClient>;
  let useCase:    GetCellByIdUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    userClient = makeUserClient();
    useCase    = new GetCellByIdUseCase(repo, userClient);
  });

  it('returns cell with enriched member profiles when caller is the leader', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', 'leader-uid', ['leader']);

    expect(result.id).toBe('cell-1');
    // members should be enriched objects, not raw UIDs
    expect(Array.isArray(result.members)).toBe(true);
    expect(result.members[0]).toHaveProperty('uid');
    expect(result.members[0]).toHaveProperty('firstName');
    expect(result.members[0]).toHaveProperty('lastName');
    expect(result.members[0]).toHaveProperty('displayName');
    expect(result.members[0].displayName).toBe('Leader One');
    expect(userClient.getMemberProfiles).toHaveBeenCalledWith(['leader-uid', 'member-uid']);
  });

  it('returns cell when caller is a member', async () => {
    repo.findById.mockResolvedValue(makeCell({ members: ['leader-uid', 'member-uid'] }));

    const result = await useCase.execute('cell-1', 'member-uid', ['member']);

    expect(result.id).toBe('cell-1');
    expect(result.members[0].firstName).toBe('Leader');
    expect(result.members[1].firstName).toBe('Member');
  });

  it('returns cell when caller is admin (even if not a member)', async () => {
    repo.findById.mockResolvedValue(makeCell({ members: ['leader-uid'] }));
    userClient.getMemberProfiles.mockResolvedValue([
      { uid: 'leader-uid', firstName: 'Leader', lastName: 'One', displayName: 'Leader One' },
    ]);

    const result = await useCase.execute('cell-1', 'admin-uid', ['admin']);

    expect(result.id).toBe('cell-1');
    expect(result.members).toHaveLength(1);
  });

  it('returns cell when caller is super_admin', async () => {
    repo.findById.mockResolvedValue(makeCell({ members: [] }));
    userClient.getMemberProfiles.mockResolvedValue([]);

    const result = await useCase.execute('cell-1', 'sa-uid', ['super_admin']);

    expect(result.id).toBe('cell-1');
    expect(result.members).toHaveLength(0);
  });

  it('throws 404 when cell does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad-id', 'uid', ['admin'])).rejects.toMatchObject({
      status: 404, errorCode: 'CELL_NOT_FOUND',
    });
    expect(userClient.getMemberProfiles).not.toHaveBeenCalled();
  });

  it('throws 403 when caller is not a member, owner, or admin', async () => {
    repo.findById.mockResolvedValue(makeCell({ members: ['leader-uid'] }));

    await expect(useCase.execute('cell-1', 'stranger-uid', ['member'])).rejects.toMatchObject({
      status: 403, errorCode: 'FORBIDDEN',
    });
    expect(userClient.getMemberProfiles).not.toHaveBeenCalled();
  });
});
