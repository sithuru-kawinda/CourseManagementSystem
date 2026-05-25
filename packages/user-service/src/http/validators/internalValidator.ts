import { z } from 'zod';

export const checkEmailSchema = z.object({
  email: z.string().email(),
});

export const approveUserSchema = z.object({
  uid: z.string().min(1),
});

export const addRoleSchema = z.object({
  uid:  z.string().min(1),
  role: z.enum(['member', 'student', 'leader', 'g12', 'admin', 'super_admin']),
});

export const removeRoleSchema = z.object({
  uid:  z.string().min(1),
  role: z.enum(['student', 'leader', 'g12']), // member can never be removed
});
