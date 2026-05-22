import { RoleGrantedHandler }        from '../../../src/application/handlers/RoleGrantedHandler';
import { INotificationRepository }  from '../../../src/domain/repositories/INotificationRepository';
import { NotificationDispatcher }   from '../../../src/application/services/NotificationDispatcher';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

const FULL_PAYLOAD = {
  requesterUid:     'uid-1',
  role:             'student',
  decidedByUid:     'admin-uid',
  email:            'john@example.com',
  studentFirstName: 'John',
  studentLastName:  'Doe',
  note:             'Welcome to Bible School!',
  appUrl:           'https://cms.bethelnet.au/login',
};

describe('RoleGrantedHandler', () => {
  let repo:       jest.Mocked<INotificationRepository>;
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let handler:    RoleGrantedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    dispatcher = makeDispatcher();
    handler    = new RoleGrantedHandler(repo, dispatcher);
  });

  // ── In-app notification ───────────────────────────────────────────────────

  it('creates in-app notification for the student with role.granted type', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'role.granted', userUid: 'uid-1' }),
    );
  });

  it('in-app notification title mentions the role label', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Student') }),
    );
  });

  // ── Approval email ────────────────────────────────────────────────────────

  it('sends approval email to the student when email is present', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'john@example.com',
      expect.stringContaining('Student'),
      expect.any(String),
      'req-1',
    );
  });

  it('email subject contains "Approved" and the role label', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, subject] = dispatcher.dispatchEmail.mock.calls[0];
    expect(subject).toMatch(/student/i);
    expect(subject).toMatch(/approved/i);
  });

  it('email body greets student by full name', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('John Doe');
  });

  it('email body shows congratulations and the role label', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toMatch(/congratulations/i);
    expect(html).toContain('Student');
  });

  it('email body contains the admin note in a callout block', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Welcome to Bible School!');
    expect(html).toContain('Message from the admin');
  });

  it('email body has no note callout when note is absent', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle({ ...FULL_PAYLOAD, note: undefined }, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).not.toContain('Message from the admin');
  });

  it('email body contains the login link (appUrl)', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('https://cms.bethelnet.au/login');
  });

  it('student role email includes next-steps list (browse courses, enroll)', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Browse available courses');
    expect(html).toContain('enrollment');
  });

  it('skips email when email field is absent', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle({ ...FULL_PAYLOAD, email: undefined }, 'req-1');

    expect(dispatcher.dispatchEmail).not.toHaveBeenCalled();
  });

  it('propagates errors from repo.create', async () => {
    repo.create.mockRejectedValue(new Error('DB error'));
    await expect(handler.handle(FULL_PAYLOAD, 'req-1')).rejects.toThrow('DB error');
  });
});
