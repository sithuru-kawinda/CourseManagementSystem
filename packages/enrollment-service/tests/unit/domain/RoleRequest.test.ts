import { RoleRequest, RoleRequestProps } from '../../../src/domain/entities/RoleRequest';

const baseProps: RoleRequestProps = {
  id:            'req-1',
  requesterUid:  'uid-1',
  requestedRole: 'student',
  status:        'pending',
  decidedByUid:  null,
  decisionNote:  null,
  createdAt:     '2026-01-01T00:00:00.000Z',
  decidedAt:     null,
  applicantProfile: {
    firstName:          'John',
    lastName:           'Doe',
    phoneNumber:        '+94771234567',
    email:              'john@example.com',
    dateOfBirth:        '2000-06-15',
    gender:             'male',
    address:            '123 Main St, Colombo',
    qualificationTitle: 'BSc Computer Science',
    qualificationUrl:   null,
  },
  qualificationTitle:       'BSc Computer Science',
  qualificationStoragePath: null,
};

const make = (status: 'pending' | 'approved' | 'rejected' = 'pending'): RoleRequest =>
  new RoleRequest({ ...baseProps, status });

describe('RoleRequest entity', () => {
  describe('constructor', () => {
    it('stores all applicant profile fields', () => {
      const r = make();
      expect(r.applicantProfile.firstName).toBe('John');
      expect(r.applicantProfile.lastName).toBe('Doe');
      expect(r.applicantProfile.phoneNumber).toBe('+94771234567');
      expect(r.applicantProfile.email).toBe('john@example.com');
      expect(r.applicantProfile.dateOfBirth).toBe('2000-06-15');
      expect(r.applicantProfile.gender).toBe('male');
      expect(r.applicantProfile.address).toBe('123 Main St, Colombo');
    });

    it('stores qualification title and storage path', () => {
      const r = make();
      expect(r.qualificationTitle).toBe('BSc Computer Science');
      expect(r.qualificationStoragePath).toBeNull();
    });
  });

  describe('approve()', () => {
    it('transitions PENDING → approved', () => {
      const r = make('pending');
      r.approve('admin-uid', 'Welcome!');
      expect(r.status).toBe('approved');
    });

    it('sets decidedByUid and decisionNote', () => {
      const r = make();
      r.approve('admin-uid', 'Welcome!');
      expect(r.decidedByUid).toBe('admin-uid');
      expect(r.decisionNote).toBe('Welcome!');
    });

    it('sets decidedAt', () => {
      const r = make();
      r.approve('admin-uid');
      expect(r.decidedAt).not.toBeNull();
    });

    it('stores null note when not provided', () => {
      const r = make();
      r.approve('admin-uid');
      expect(r.decisionNote).toBeNull();
    });

    it('throws 409 when already approved', () => {
      expect(() => make('approved').approve('admin-uid')).toThrow(
        expect.objectContaining({ status: 409, errorCode: 'INVALID_STATE' }),
      );
    });

    it('throws 409 when already rejected', () => {
      expect(() => make('rejected').approve('admin-uid')).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    });
  });

  describe('reject()', () => {
    it('transitions PENDING → rejected', () => {
      const r = make('pending');
      r.reject('admin-uid', 'Batch full');
      expect(r.status).toBe('rejected');
      expect(r.decisionNote).toBe('Batch full');
    });

    it('sets decidedAt and decidedByUid', () => {
      const r = make();
      r.reject('admin-uid');
      expect(r.decidedAt).not.toBeNull();
      expect(r.decidedByUid).toBe('admin-uid');
    });

    it('stores null note when not provided', () => {
      const r = make();
      r.reject('admin-uid');
      expect(r.decisionNote).toBeNull();
    });

    it('throws 409 when already rejected', () => {
      expect(() => make('rejected').reject('admin-uid')).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    });

    it('throws 409 when already approved', () => {
      expect(() => make('approved').reject('admin-uid')).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    });
  });
});
