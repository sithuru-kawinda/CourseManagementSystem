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

// Standard payload — login-link flow (no OTP)
const PAYLOAD = {
  uid:       'uid-1',
  email:     'alice@example.com',
  firstName: 'Alice',
  lastName:  'Smith',
  password:  'SecurePass@2026',
  appUrl:    'https://tccr.lk/login',
};

// Minimal payload — no password, no appUrl
const PAYLOAD_MINIMAL = {
  uid:       'uid-2',
  email:     'bob@example.com',
  firstName: 'Bob',
  lastName:  'Lee',
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

  it('creates in-app notification for each admin with "New Member Joined" title', async () => {
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

  // ── Welcome email — subject ───────────────────────────────────────────────

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

  it('subject says "Your Account is Ready"', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-subject');

    const [, subject] = dispatcher.dispatchEmail.mock.calls[0];
    expect(subject).toMatch(/your account is ready/i);
  });

  it('subject is the same regardless of whether appUrl is present', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD_MINIMAL, 'req-subject-no-url');

    const [, subject] = dispatcher.dispatchEmail.mock.calls[0];
    expect(subject).toMatch(/welcome to tccr/i);
  });

  // ── Welcome email — body content ──────────────────────────────────────────

  it('email body greets the user by full name', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-name');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Alice Smith');
  });

  it('email body includes the user email address', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-email');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('alice@example.com');
  });

  it('email body includes the password when present in payload', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-password');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('SecurePass@2026');
  });

  it('email body contains Login button with the appUrl', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-btn');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Log in to TCCR');
    expect(html).toContain('https://tccr.lk/login');
  });

  it('email body uses fallback login URL when appUrl is absent', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD_MINIMAL, 'req-fallback');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    // Fallback URL from config — button is always rendered
    expect(html).toContain('Log in to TCCR');
    expect(html).toContain('cms.bethelnet.au');
  });

  it('does NOT contain any OTP code — login-link flow replaces OTP flow', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-no-otp');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    // No 6-digit OTP block — users go straight to the login page
    expect(html).not.toMatch(/\b\d{6}\b/);
    expect(html).not.toContain('verify-email');
  });

  it('sends welcome email even when password is omitted in payload', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD_MINIMAL, 'req-no-pass');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'bob@example.com',
      expect.stringContaining('Welcome to TCCR'),
      expect.any(String),
      'req-no-pass',
    );
  });

  it('email body includes TCCR branding (The Christian Center Rathmalana)', async () => {
    userClient.getAdminUids.mockResolvedValue([]);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-brand');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('The Christian Center Rathmalana');
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('propagates errors from userClient.getAdminUids', async () => {
    userClient.getAdminUids.mockRejectedValue(new Error('Client error'));
    await expect(handler.handle(PAYLOAD, 'req-err')).rejects.toThrow('Client error');
  });
});
