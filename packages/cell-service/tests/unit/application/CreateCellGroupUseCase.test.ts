import { CreateCellGroupUseCase } from '../../../src/application/use-cases/CreateCellGroupUseCase';
import { ICellGroupRepository }   from '../../../src/domain/repositories/ICellGroupRepository';
import { OutboxEventPublisher }   from '@shared/events';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById:     jest.fn(),
  findByMember: jest.fn(),
  findAll:      jest.fn(),
  create:       jest.fn(),
  update:       jest.fn(),
  delete:       jest.fn(),
});
const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('CreateCellGroupUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: CreateCellGroupUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    outbox  = makeOutbox();
    useCase = new CreateCellGroupUseCase(repo, outbox);
  });

  it('creates a cell with leader as first member and publishes cell.created', async () => {
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute({
      name: 'Rathmalana West', type: 'g12', area: 'Rathmalana',
      leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
    }, 'req-1');

    expect(result.name).toBe('Rathmalana West');
    expect(result.state).toBe('active');
    expect(result.members).toContain('leader-1');
    expect(result.memberCount).toBe(1);
    expect(result.reportCount).toBe(0);
    expect(result.id).toBeDefined();
    expect(repo.create).toHaveBeenCalledWith(result);
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cell.created' }),
    );
  });

  it('generates a unique ID for each cell', async () => {
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const a = await useCase.execute({ name: 'A', type: 'care', area: 'X', leaderUid: 'u1', g12LeaderUid: 'g1' }, 'r1');
    const b = await useCase.execute({ name: 'B', type: 'care', area: 'X', leaderUid: 'u2', g12LeaderUid: 'g1' }, 'r2');

    expect(a.id).not.toBe(b.id);
  });
});
