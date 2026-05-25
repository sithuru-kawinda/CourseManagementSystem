import { GetRoleRequestByIdUseCase } from '../../../src/application/use-cases/GetRoleRequestByIdUseCase';
import { IRoleRequestRepository }   from '../../../src/domain/repositories/IRoleRequestRepository';
import { RoleRequest }              from '../../../src/domain/entities/RoleRequest';
import { UserServiceClient }        from '../../../src/infrastructure/clients/UserServiceClient';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:               jest.fn(),
  findPendingByRequester: jest.fn(),
  findByRequester:        jest.fn(),
  findAll:                jest.fn(),
  create:                 jest.fn(),
  update:                 jest.fn(),
});

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({
    approveUser:       jest.fn(),
    addRole:           jest.fn(),
    getUser:           jest.fn(),
    getMemberProfile:  jest.fn(),
  } as unknown as jest.Mocked<UserServiceClient>);

const MEMBER_PROFILE = {
  uid:               'uid-member',
  email:             'john@example.com',
  firstName:         'John',
  lastName:          'Doe',
  phoneNumber:       '+94771234567',
  profilePhotoUrl:   'https://storage.example.com/avatars/uid-member.jpg',
  dateOfBirth:       '2000-06-15',
  gender:            'male' as const,
  address:           '123 Main St',
  preferredLanguage: 'en',
  roles:             ['member'],
  status:            'approved',
  accountCreatedAt:  '2026-04-10T07:30:00.000Z',
  qualifications:    [{ id: 'qual-001', title: 'BSc Computer Science', fileUrl: 'https://storage.example.com/q.pdf' }],
  qualificationTitle: 'BSc Computer Science',
  qualificationUrl:   'https://storage.example.com/q.pdf',
};

const makeRequest = (
  requesterUid = 'uid-member',
  status: 'pending' | 'approved' | 'rejected' = 'pending',
): RoleRequest =>
  new RoleRequest({
    id:               'req-abc',
    requesterUid,
    requestedRole:    'student',
    status,
    decidedByUid:     null,
    decisionNote:     null,
    createdAt:        '2026-01-01T00:00:00.000Z',
    decidedAt:        null,
    applicantProfile: {
      firstName:          'John',
      lastName:           'Doe',
      phoneNumber:        '+94771234567',
      email:              'john@example.com',
      dateOfBirth:        '2000-06-15',
      gender:             'male',
      address:            '123 Main St',
      qualificationTitle: null,
      qualificationUrl:   null,
    },
    qualificationTitle:       'BSc Computer Science',
    qualificationStoragePath: null,
  });

// ── tests ─────────────────────────────────────────────────────────────────────

describe('GetRoleRequestByIdUseCase', () => {
  let repo:       jest.Mocked<IRoleRequestRepository>;
  let userClient: jest.Mocked<UserServiceClient>;
  let useCase:    GetRoleRequestByIdUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    userClient = makeUserClient();
    useCase    = new GetRoleRequestByIdUseCase(repo, userClient);
  });

  // ── 404 ─────────────────────────────────────────────────────────────────────

  it('throws 404 ROLE_REQUEST_NOT_FOUND when the request does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ id: 'missing-id', requesterUid: 'uid-admin', isAdmin: true }))
      .rejects.toMatchObject({ status: 404, errorCode: 'ROLE_REQUEST_NOT_FOUND' });

    expect(repo.findById).toHaveBeenCalledWith('missing-id');
  });

  it('throws 404 for a non-admin caller when the request does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ id: 'ghost-req', requesterUid: 'uid-member', isAdmin: false }))
      .rejects.toMatchObject({ status: 404, errorCode: 'ROLE_REQUEST_NOT_FOUND' });
  });

  // ── admin / super_admin — with memberProfile ──────────────────────────────

  it('admin can read any role request regardless of requesterUid', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-other'));
    userClient.getMemberProfile.mockResolvedValue(MEMBER_PROFILE);

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-admin', isAdmin: true });

    expect(result.id).toBe('req-abc');
  });

  it('admin response includes live memberProfile fetched from user-service', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member'));
    userClient.getMemberProfile.mockResolvedValue(MEMBER_PROFILE);

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-admin', isAdmin: true });

    expect(result.memberProfile).not.toBeNull();
    expect(result.memberProfile?.uid).toBe('uid-member');
    expect(result.memberProfile?.email).toBe('john@example.com');
    expect(result.memberProfile?.firstName).toBe('John');
    expect(result.memberProfile?.profilePhotoUrl).toBe('https://storage.example.com/avatars/uid-member.jpg');
    expect(result.memberProfile?.roles).toEqual(['member']);
    expect(result.memberProfile?.status).toBe('approved');
    expect(result.memberProfile?.accountCreatedAt).toBe('2026-04-10T07:30:00.000Z');
    expect(result.memberProfile?.qualifications).toHaveLength(1);
    expect(result.memberProfile?.qualifications[0].title).toBe('BSc Computer Science');
  });

  it('admin getMemberProfile is called with the requester UID (not the admin UID)', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member'));
    userClient.getMemberProfile.mockResolvedValue(MEMBER_PROFILE);

    await useCase.execute({ id: 'req-abc', requesterUid: 'uid-admin', isAdmin: true });

    expect(userClient.getMemberProfile).toHaveBeenCalledWith('uid-member');
  });

  it('memberProfile is null when user-service returns null (non-fatal degradation)', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member'));
    userClient.getMemberProfile.mockResolvedValue(null);

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-admin', isAdmin: true });

    expect(result.memberProfile).toBeNull();
    expect(result.id).toBe('req-abc'); // role request data still returned
  });

  it('super_admin (isAdmin=true) can read any role request and gets memberProfile', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-other'));
    userClient.getMemberProfile.mockResolvedValue(MEMBER_PROFILE);

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-sadmin', isAdmin: true });

    expect(result.id).toBe('req-abc');
    expect(result.memberProfile).not.toBeNull();
  });

  // ── member — own request (no memberProfile) ──────────────────────────────

  it('member can read their own pending role request', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member', 'pending'));

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-member', isAdmin: false });

    expect(result.id).toBe('req-abc');
    expect(result.status).toBe('pending');
    expect(result.requesterUid).toBe('uid-member');
  });

  it('non-admin response has memberProfile null (no user-service call)', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member', 'pending'));

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-member', isAdmin: false });

    expect(result.memberProfile).toBeNull();
    expect(userClient.getMemberProfile).not.toHaveBeenCalled();
  });

  it('member can read their own approved role request', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member', 'approved'));

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-member', isAdmin: false });

    expect(result.status).toBe('approved');
  });

  it('member can read their own rejected role request', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member', 'rejected'));

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-member', isAdmin: false });

    expect(result.status).toBe('rejected');
  });

  it('returns all applicantProfile fields intact for the member', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member'));

    const result = await useCase.execute({ id: 'req-abc', requesterUid: 'uid-member', isAdmin: false });

    expect(result.applicantProfile.firstName).toBe('John');
    expect(result.applicantProfile.lastName).toBe('Doe');
    expect(result.applicantProfile.email).toBe('john@example.com');
    expect(result.applicantProfile.dateOfBirth).toBe('2000-06-15');
    expect(result.applicantProfile.gender).toBe('male');
    expect(result.applicantProfile.address).toBe('123 Main St');
    expect(result.qualificationTitle).toBe('BSc Computer Science');
    expect(result.qualificationStoragePath).toBeNull();
  });

  // ── member — ownership violation ─────────────────────────────────────────────

  it('member cannot read another user\'s role request → 403 FORBIDDEN', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-other-member'));

    await expect(useCase.execute({ id: 'req-abc', requesterUid: 'uid-member', isAdmin: false }))
      .rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('student (isAdmin=false) cannot read another user\'s role request → 403 FORBIDDEN', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-other'));

    await expect(useCase.execute({ id: 'req-abc', requesterUid: 'uid-student', isAdmin: false }))
      .rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('leader (isAdmin=false) cannot read a member\'s role request → 403 FORBIDDEN', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member'));

    await expect(useCase.execute({ id: 'req-abc', requesterUid: 'uid-leader', isAdmin: false }))
      .rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('g12 (isAdmin=false) cannot read a different member\'s role request → 403 FORBIDDEN', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member'));

    await expect(useCase.execute({ id: 'req-abc', requesterUid: 'uid-g12', isAdmin: false }))
      .rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  // ── repository interaction ────────────────────────────────────────────────────

  it('calls findById exactly once per execute', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member'));

    await useCase.execute({ id: 'req-abc', requesterUid: 'uid-member', isAdmin: false });

    expect(repo.findById).toHaveBeenCalledTimes(1);
    expect(repo.findById).toHaveBeenCalledWith('req-abc');
  });

  it('does not call any other repository methods', async () => {
    repo.findById.mockResolvedValue(makeRequest('uid-member'));

    await useCase.execute({ id: 'req-abc', requesterUid: 'uid-member', isAdmin: false });

    expect(repo.findAll).not.toHaveBeenCalled();
    expect(repo.findByRequester).not.toHaveBeenCalled();
    expect(repo.findPendingByRequester).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
