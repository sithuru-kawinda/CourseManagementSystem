import { CellJoinApprovedHandler } from '../../../src/application/handlers/CellJoinApprovedHandler';
import { INotificationRepository } from '../../../src/domain/repositories/INotificationRepository';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const PAYLOAD = {
  cellId:        'cell-001',
  cellName:      'Rathmalana West G12',
  memberUid:     'member-uid-1',
  joinRequestId: 'jr-001',
  decidedByUid:  'admin-uid-1',
};

describe('CellJoinApprovedHandler', () => {
  let repo:    jest.Mocked<INotificationRepository>;
  let handler: CellJoinApprovedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    handler = new CellJoinApprovedHandler(repo);
  });

  it('sends in-app notification to the approved member', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: 'member-uid-1',
        type:    'cell.join_approved',
        title:   'Cell Join Request Approved',
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

  it('notification body mentions approval/welcome', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringMatching(/approved|welcome/i) }),
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
