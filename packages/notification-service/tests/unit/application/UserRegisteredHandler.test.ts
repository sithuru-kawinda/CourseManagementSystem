import { UserRegisteredHandler }    from '../../../src/application/handlers/UserRegisteredHandler';
import { INotificationRepository } from '../../../src/domain/repositories/INotificationRepository';
import { NotificationDispatcher }  from '../../../src/application/services/NotificationDispatcher';
import { UserServiceClient }       from '../../../src/infrastructure/clients/UserServiceClient';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ getAdminUids: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

const PAYLOAD = {
  uid:       'uid-1',
  email:     'alice@example.com',
  firstName: 'Alice',
  lastName:  'Smith',
  password:  'SecurePass@2026',
  appUrl:    'https://tccr.lk',
};

describe('UserRegisteredHandler', () => {
  let repo:       jest.Mocked<INotificationRepository>;
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let userClient: jest.Mocked<UserServiceClient>;
  let handler:    UserRegisteredHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    dispatcher = makeDispatcher();
    userClient = makeUserClient();
    handler    = new UserRegisteredHandler(repo, userClient, dispatcher);
  });

  // ── Admin notifications ───────────────────────────────────────────────────

  it('creates in-app notification for each admin with V2 "New Member Joined" title', async () => {
    userClient.getAdminUids.mockResolvedValue(['admin-1', 'admin-2']);
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledTimes(2);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'user.registered', userUid: 'admin-1', title: 'New Member Joined' }),
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'user.registered', userUid: 'admin-2', title: 'New Member Joined' }),
    );
  });

  it('admin notification body mentions the registrant full name', async () => {
    userClient.getAdminUids.mockResolvedValue(['admin-1']);
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Alice Smith') }),
    );
  });

  it('creates no admin notifications when no admins exist', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).not.toHaveBeenCalled();
    expect(dispatcher.dispatchEmail).toHaveBeenCalledTimes(1);
  });

  // ── Welcome email ─────────────────────────────────────────────────────────

  it('sends welcome email to the registering user', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'alice@example.com',
      expect.stringContaining('Welcome to TCCR'),
      expect.any(String),
      'req-1',
    );
  });

  it('welcome email subject says account is active (V2 — no approval wait)', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    const [, subject] = dispatcher.dispatchEmail.mock.calls[0];
    expect(subject).not.toMatch(/pending/i);
    expect(subject).toMatch(/active/i);
  });

  it('welcome email body includes the user email address', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('alice@example.com');
  });

  it('welcome email body includes the password', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('SecurePass@2026');
  });

  it('welcome email body includes the login link (appUrl)', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('https://tccr.lk');
  });

  it('welcome email body greets the user by full name', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Alice Smith');
  });

  it('sends welcome email even when password is omitted in payload', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);
    const payloadNoPassword = { uid: 'uid-2', email: 'bob@example.com', firstName: 'Bob', lastName: 'Lee' };

    await handler.handle(payloadNoPassword, 'req-2');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'bob@example.com',
      expect.stringContaining('Welcome to TCCR'),
      expect.any(String),
      'req-2',
    );
  });

  it('omits login button when appUrl is not in payload', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);
    const payloadNoUrl = { ...PAYLOAD, appUrl: undefined };

    await handler.handle(payloadNoUrl, 'req-3');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).not.toContain('Log in to TCCR');
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('propagates errors from userClient.getAdminUids', async () => {
    userClient.getAdminUids.mockRejectedValue(new Error('Client error'));
    await expect(handler.handle(PAYLOAD, 'req-1')).rejects.toThrow('Client error');
  });
});
