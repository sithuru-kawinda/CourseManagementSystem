import { CellJoinRequestedHandler } from '../../../src/application/handlers/CellJoinRequestedHandler';
import { INotificationRepository }  from '../../../src/domain/repositories/INotificationRepository';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const PAYLOAD = {
  cellId:        'cell-001',
  cellName:      'Rathmalana West G12',
  leaderUid:     'leader-uid-1',
  g12LeaderUid:  'g12-uid-1',
  requesterUid:  'member-uid-1',
  joinRequestId: 'jr-001',
};

describe('CellJoinRequestedHandler', () => {
  let repo:    jest.Mocked<INotificationRepository>;
  let handler: CellJoinRequestedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    handler = new CellJoinRequestedHandler(repo);
  });

  it('sends in-app notification to the cell leader', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: 'leader-uid-1',
        type:    'cell.join_requested',
        title:   'New Cell Join Request',
      }),
    );
  });

  it('sends in-app notification to the G12 leader', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: 'g12-uid-1',
        type:    'cell.join_requested',
      }),
    );
  });

  it('sends exactly 2 notifications when leader and G12 are different people', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledTimes(2);
  });

  it('sends only 1 notification when leader and G12 are the same person', async () => {
    repo.create.mockResolvedValue(undefined);
    const samePersonPayload = { ...PAYLOAD, g12LeaderUid: 'leader-uid-1' };

    await handler.handle(samePersonPayload, 'req-dedupe');

    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('notification body mentions the cell name', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Rathmalana West G12') }),
    );
  });

  it('notification is created with read: false', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ read: false }),
    );
  });
});
