import { EnrollmentRejectedHandler } from '../../../src/application/handlers/EnrollmentRejectedHandler';
import { INotificationRepository }  from '../../../src/domain/repositories/INotificationRepository';
import { NotificationDispatcher }   from '../../../src/application/services/NotificationDispatcher';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

const FULL_PAYLOAD = {
  studentUid:       'uid-1',
  courseId:         'c1',
  email:            'bob@example.com',
  studentFirstName: 'Bob',
  studentLastName:  'Jones',
  courseTitle:      'Bible Foundations',
  reason:           'Batch capacity reached for this intake.',
  appUrl:           'https://cms.bethelnet.au/login',
};

describe('EnrollmentRejectedHandler', () => {
  let repo:       jest.Mocked<INotificationRepository>;
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let handler:    EnrollmentRejectedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    dispatcher = makeDispatcher();
    handler    = new EnrollmentRejectedHandler(repo, dispatcher);
  });

  // ── In-app notification ───────────────────────────────────────────────────

  it('creates in-app notification for the student with enrollment.rejected type', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'enrollment.rejected', userUid: 'uid-1' }),
    );
  });

  it('notification body includes the reason when provided', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Batch capacity reached') }),
    );
  });

  it('notification body mentions course title when provided', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Bible Foundations') }),
    );
  });

  it('notification body is generic when reason is null', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle({ ...FULL_PAYLOAD, reason: null }, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('not approved') }),
    );
  });

  // ── Rejection email ───────────────────────────────────────────────────────

  it('sends rejection email to the student when email is present', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'bob@example.com',
      expect.stringContaining('Bible Foundations'),
      expect.any(String),
      'req-1',
    );
  });

  it('email subject contains the course title', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, subject] = dispatcher.dispatchEmail.mock.calls[0];
    expect(subject).toContain('Bible Foundations');
  });

  it('email body greets student by full name', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Bob Jones');
  });

  it('email body contains the rejection reason in a highlighted block', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Batch capacity reached for this intake.');
    expect(html).toContain('Reason:');
  });

  it('email body shows "no reason provided" text when reason is null', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle({ ...FULL_PAYLOAD, reason: null }, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).not.toContain('Reason:');
    expect(html).toContain('No specific reason');
  });

  it('email body contains the login link (appUrl)', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('https://cms.bethelnet.au/login');
  });

  it('skips email when email field is absent', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle({ ...FULL_PAYLOAD, email: undefined }, 'req-1');

    expect(dispatcher.dispatchEmail).not.toHaveBeenCalled();
  });

  it('generic subject when courseTitle is absent', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle({ ...FULL_PAYLOAD, courseTitle: undefined }, 'req-1');

    const [, subject] = dispatcher.dispatchEmail.mock.calls[0];
    expect(subject).toMatch(/not approved/i);
    expect(subject).not.toContain('undefined');
  });

  it('propagates errors from repo.create', async () => {
    repo.create.mockRejectedValue(new Error('DB error'));
    await expect(handler.handle(FULL_PAYLOAD, 'req-1')).rejects.toThrow('DB error');
  });
});
