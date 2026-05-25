import { CellJoinRejectedHandler } from '../../../src/application/handlers/CellJoinRejectedHandler';
import { INotificationRepository } from '../../../src/domain/repositories/INotificationRepository';

const makeRepo = (): jest.Mocked<INotificationRepository> =>
  ({ findByUser: jest.fn(), create: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() });

const PAYLOAD = {
  cellId:        'cell-001',
  cellName:      'Rathmalana West G12',
  requesterUid:  'member-uid-1',
  joinRequestId: 'jr-001',
  decidedByUid:  'admin-uid-1',
};

describe('CellJoinRejectedHandler', () => {
  let repo:    jest.Mocked<INotificationRepository>;
  let handler: CellJoinRejectedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    handler = new CellJoinRejectedHandler(repo);
  });

  it('sends in-app notification to the rejected member', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: 'member-uid-1',
        type:    'cell.join_rejected',
        title:   'Cell Join Request Not Approved',
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

  it('notification body encourages applying to another cell', async () => {
    repo.create.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD, 'req-1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringMatching(/apply|another/i) }),
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
