import { EnrollmentApprovedHandler } from '../../../src/application/handlers/EnrollmentApprovedHandler';
import { INotificationRepository }   from '../../../src/domain/repositories/INotificationRepository';
import { NotificationDispatcher }    from '../../../src/application/services/NotificationDispatcher';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

const FULL_PAYLOAD = {
  studentUid:       'uid-1',
  courseId:         'course-1',
  email:            'alice@example.com',
  studentFirstName: 'Alice',
  studentLastName:  'Smith',
  courseTitle:      'Bible Foundations',
  note:             'Approved for the 2026 intake.',
  appUrl:           'https://cms.bethelnet.au/login',
  fcmToken:         'fcm-tok-abc',
};

describe('EnrollmentApprovedHandler', () => {
  let repo:       jest.Mocked<INotificationRepository>;
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let handler:    EnrollmentApprovedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    dispatcher = makeDispatcher();
    handler    = new EnrollmentApprovedHandler(repo, dispatcher);
  });

  // ── In-app notification ───────────────────────────────────────────────────

  it('creates in-app notification for the student with enrollment.approved type', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);
    dispatcher.dispatchPush.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'enrollment.approved', userUid: 'uid-1' }),
    );
  });

  it('in-app notification body mentions the course title', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Bible Foundations') }),
    );
  });

  // ── Email ─────────────────────────────────────────────────────────────────

  it('sends approval email to the student when email is present', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
      'alice@example.com',
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
    expect(subject).toMatch(/approved/i);
  });

  it('email body greets student by full name', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Alice Smith');
  });

  it('email body contains the admin note', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('Approved for the 2026 intake.');
  });

  it('email body contains the login link (appUrl)', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).toContain('https://cms.bethelnet.au/login');
  });

  it('email body does not include note section when note is absent', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);
    const payloadNoNote = { ...FULL_PAYLOAD, note: undefined };

    await handler.handle(payloadNoNote, 'req-1');

    const [, , html] = dispatcher.dispatchEmail.mock.calls[0];
    expect(html).not.toContain('Message from the admin');
  });

  it('skips email when email field is absent', async () => {
    repo.create.mockResolvedValue(undefined);
    const payloadNoEmail = { ...FULL_PAYLOAD, email: undefined };

    await handler.handle(payloadNoEmail, 'req-1');

    expect(dispatcher.dispatchEmail).not.toHaveBeenCalled();
  });

  it('generic subject when courseTitle is absent', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);
    const payloadNoCourse = { ...FULL_PAYLOAD, courseTitle: undefined };

    await handler.handle(payloadNoCourse, 'req-1');

    const [, subject] = dispatcher.dispatchEmail.mock.calls[0];
    expect(subject).toMatch(/approved/i);
    expect(subject).not.toContain('undefined');
  });

  // ── Push ──────────────────────────────────────────────────────────────────

  it('sends push notification when fcmToken is present', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);
    dispatcher.dispatchPush.mockResolvedValue(undefined);

    await handler.handle(FULL_PAYLOAD, 'req-1');

    expect(dispatcher.dispatchPush).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatchPush).toHaveBeenCalledWith('fcm-tok-abc', expect.any(String), expect.any(String));
  });

  it('skips push when fcmToken is absent', async () => {
    repo.create.mockResolvedValue(undefined);
    dispatcher.dispatchEmail.mockResolvedValue(undefined);
    const payloadNoFcm = { ...FULL_PAYLOAD, fcmToken: undefined };

    await handler.handle(payloadNoFcm, 'req-1');

    expect(dispatcher.dispatchPush).not.toHaveBeenCalled();
  });
});
