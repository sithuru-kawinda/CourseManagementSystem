import { z } from 'zod';

// Profile data is read from the user's existing profile — no personal fields needed here
export const createRoleRequestSchema = z.object({
  requestedRole: z.literal('student'),
});

export const decideRoleRequestSchema = z.object({
  note: z.string().max(500).optional(),
});

export const listRoleRequestsSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});
