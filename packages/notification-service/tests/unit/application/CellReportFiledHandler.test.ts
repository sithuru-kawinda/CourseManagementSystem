import { CellReportFiledHandler } from '../../../src/application/handlers/CellReportFiledHandler';
import { INotificationRepository } from '../../../src/domain/repositories/INotificationRepository';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const PAYLOAD = {
  cellId:       'cell-001',
  cellName:     'Rathmalana West G12',
  g12LeaderUid: 'g12-uid-1',
  reportId:     'report-001',
  filledByUid:  'leader-uid-1',
  date:         '2026-05-24',
};

describe('CellReportFiledHandler', () => {
  let repo:    jest.Mocked<INotificationRepository>;
  let handler: CellReportFiledHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    handler = new CellReportFiledHandler(repo);
  });

  it('sends in-app notification to the G12 leader when report is filed by the cell leader', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: 'g12-uid-1',
        type:    'cell_report.filed',
        title:   'Cell Report Filed',
      }),
    );
  });

  it('notification body mentions the cell name', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Rathmalana West G12') }),
    );
  });

  it('notification body mentions the report date', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('2026-05-24') }),
    );
  });

  it('does NOT send notification when G12 leader files their own report', async () => {
    repo.create.mockResolvedValue(undefined);
    const selfFiledPayload = { ...PAYLOAD, g12LeaderUid: 'leader-uid-1', filledByUid: 'leader-uid-1' };

    await handler.handle(selfFiledPayload, 'req-self');

    // G12 leader IS the filer — no self-notification
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('notification is created with read: false', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ read: false }),
    );
  });
});
