import { z } from 'zod';

export const listUsersSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  role:   z.enum(['member', 'student', 'leader', 'g12', 'admin', 'super_admin']).optional(),
  status: z.enum(['pending_approval', 'approved', 'rejected', 'suspended']).optional(),
  name:   z.string().min(1).max(100).optional(),
});

export const assignRoleSchema = z.object({
  role:   z.enum(['member', 'student', 'leader', 'g12', 'admin', 'super_admin']),
  action: z.enum(['add', 'remove']),
});

/** Used by G12 leaders — restricted to leader / g12 only. */
export const promoteMemberSchema = z.object({
  role: z.enum(['leader', 'g12']),
});

/** Used by leader / g12 / admin / super_admin to demote a user. */
export const demoteMemberSchema = z.object({
  role: z.enum(['student', 'leader', 'g12']),
});

export const createUserDirectlySchema = z.object({
  firstName:       z.string().min(1).max(50),
  lastName:        z.string().min(1).max(50),
  email:           z.string().email(),
  initialPassword: z.string().min(8),
  role:            z.enum(['leader', 'g12']),
});
