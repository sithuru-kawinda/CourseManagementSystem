import { GetCellsUseCase }       from '../../../src/application/use-cases/GetCellsUseCase';
import { ICellGroupRepository }  from '../../../src/domain/repositories/ICellGroupRepository';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const EMPTY_RESULT = { items: [], nextCursor: null, total: 0 };

describe('GetCellsUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let useCase: GetCellsUseCase;
  const opts = { limit: 20 };

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetCellsUseCase(repo);
    repo.findAll.mockResolvedValue(EMPTY_RESULT);
  });

  it('admin sees all cells across ALL states by default — no state filter applied', async () => {
    await useCase.execute(opts, 'admin-uid', ['admin']);

    // Admin gets everything — state is NOT forced to 'active'
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ state: 'active' }),
    );
  });

  it('admin can filter by specific state when provided', async () => {
    await useCase.execute({ ...opts, state: 'archived' }, 'admin-uid', ['admin']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'archived' }),
    );
  });

  it('super_admin sees all cells across ALL states by default — no state filter applied', async () => {
    await useCase.execute(opts, 'sa-uid', ['super_admin']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ state: 'active' }),
    );
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: 'sa-uid' }),
    );
  });

  it('leader sees only their own cells — leaderUid auto-scoped', async () => {
    await useCase.execute(opts, 'leader-uid', ['leader']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ leaderUid: 'leader-uid', state: 'active' }),
    );
  });

  it('member/student sees all active cells — no uid scope', async () => {
    await useCase.execute(opts, 'member-uid', ['member']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'active' }),
    );
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: 'member-uid' }),
    );
  });

  it('g12 sees all cells — same as admin', async () => {
    await useCase.execute(opts, 'g12-uid', ['g12']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'active' }),
    );
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: 'g12-uid' }),
    );
  });

  it('returns whatever the repository returns', async () => {
    const result = { items: [], nextCursor: 'abc', total: 5 };
    repo.findAll.mockResolvedValue(result);

    const response = await useCase.execute(opts, 'admin-uid', ['admin']);

    expect(response).toBe(result);
  });
});
