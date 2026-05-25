import { CellOwnershipTransferredHandler } from '../../../src/application/handlers/CellOwnershipTransferredHandler';
import { INotificationRepository }         from '../../../src/domain/repositories/INotificationRepository';
import { NotificationDispatcher }          from '../../../src/application/services/NotificationDispatcher';
import { UserServiceClient }               from '../../../src/infrastructure/clients/UserServiceClient';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ getAdminUids: jest.fn(), getUserById: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

const LEADER_USER  = { uid: 'new-leader', email: 'leader@test.com', firstName: 'Kasun',  lastName: 'Perera' };
const G12_USER     = { uid: 'new-g12',    email: 'g12@test.com',    firstName: 'Ushani', lastName: 'Amanda' };

const BASE_PAYLOAD = {
  cellId:               'cell-1',
  cellName:             'Rathmalana West G12',
  newLeaderUid:         'new-leader',
  newG12LeaderUid:      'new-g12',
  previousLeaderUid:    'old-leader',
  previousG12LeaderUid: 'old-g12',
  transferredByUid:     'admin-uid',
  leaderChanged:        true,
  g12Changed:           true,
};

describe('CellOwnershipTransferredHandler', () => {
  let repo:       jest.Mocked<INotificationRepository>;
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let userClient: jest.Mocked<UserServiceClient>;
  let handler:    CellOwnershipTransferredHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    dispatcher = makeDispatcher();
    userClient = makeUserClient();
    handler    = new CellOwnershipTransferredHandler(repo, userClient, dispatcher);
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);
    userClient.getUserById.mockImplementation(async (uid) => {
      if (uid === 'new-leader') return LEADER_USER;
      if (uid === 'new-g12')    return G12_USER;
      return null;
    });
  });

  // ── In-app notifications ──────────────────────────────────────────────────

  it('sends in-app notification to new leader when leader changed', async () => {
    await handler.handle(BASE_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: 'new-leader',
        type:    'cell.ownership_transferred',
        title:   'Cell Leadership Assigned',
      }),
    );
  });

  it('sends in-app notification to new G12 when G12 changed and is different person', async () => {
    await handler.handle(BASE_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: 'new-g12',
        type:    'cell.ownership_transferred',
        title:   'G12 Leadership Assigned',
      }),
    );
  });

  it('sends only one notification when same person is both new leader and G12', async () => {
    const samePersonPayload = {
      ...BASE_PAYLOAD,
      newLeaderUid: 'same-uid', newG12LeaderUid: 'same-uid',
      leaderChanged: true, g12Changed: true,
    };
    userClient.getUserById.mockResolvedValue(
      { uid: 'same-uid', email: 'same@test.com', firstName: 'Same', lastName: 'Person' },
    );

    await handler.handle(samePersonPayload, 'req-1');

    // Only one in-app notification (not two for same person)
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('skips leader notification when leaderChanged is false', async () => {
    const payload = { ...BASE_PAYLOAD, leaderChanged: false };

    await handler.handle(payload, 'req-1');

    expect(repo.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ userUid: 'new-leader', title: 'Cell Leadership Assigned' }),
    );
  });

  it('notification body mentions cell name', async () => {
    const payload = { ...BASE_PAYLOAD, g12Changed: false };

    await handler.handle(payload, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Rathmalana West G12') }),
    );
  });

  // ── Email notifications ───────────────────────────────────────────────────

  it('sends email to new leader', async () => {
    await handler.handle(BASE_PAYLOAD, 'req-1');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'leader@test.com',
      expect.stringContaining('Cell Leader'),
      expect.any(String),
      'req-1',
    );
  });

  it('sends email to new G12 leader when different from leader', async () => {
    await handler.handle(BASE_PAYLOAD, 'req-1');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'g12@test.com',
      expect.stringContaining('G12 Leader'),
      expect.any(String),
      'req-1',
    );
  });

  it('sends only one email when same person is both leader and G12', async () => {
    const samePersonPayload = {
      ...BASE_PAYLOAD,
      newLeaderUid: 'same-uid', newG12LeaderUid: 'same-uid',
      leaderChanged: true, g12Changed: true,
    };
    userClient.getUserById.mockResolvedValue(
      { uid: 'same-uid', email: 'same@test.com', firstName: 'Same', lastName: 'Person' },
    );

    await handler.handle(samePersonPayload, 'req-1');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledTimes(1);
  });

  it('skips email when user lookup returns null (fire-and-forget safe)', async () => {
    userClient.getUserById.mockResolvedValue(null);

    await expect(handler.handle(BASE_PAYLOAD, 'req-1')).resolves.not.toThrow();
    expect(dispatcher.dispatchEmail).not.toHaveBeenCalled();
  });
});
