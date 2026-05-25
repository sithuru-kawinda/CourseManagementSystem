import { z } from 'zod';

export const createCellSchema = z.object({
  name:         z.string().min(1).max(200),
  type:         z.enum(['g12', 'care', 'children', 'outreach']),
  area:         z.string().min(1).max(200),
  g12LeaderUid: z.string().min(1),
});

export const updateCellSchema = z.object({
  name:         z.string().min(1).max(200).optional(),
  type:         z.enum(['g12', 'care', 'children', 'outreach']).optional(),
  area:         z.string().min(1).max(200).optional(),
  g12LeaderUid: z.string().min(1).optional(),
});

export const addMembersSchema = z.object({
  userUids: z.array(z.string().min(1)).min(1).max(50),
});

export const createJoinRequestSchema = z.object({
  message: z.string().max(500).nullable().optional(),
});

export const decideJoinRequestSchema = z.object({
  note: z.string().max(500).optional(),
});

export const listCellsSchema = z.object({
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  cursor:    z.string().optional(),
  state:     z.enum(['active', 'archived']).optional(),
  type:      z.enum(['g12', 'care', 'children', 'outreach']).optional(),
  area:      z.string().optional(),
  leaderUid: z.string().optional(),
  search:    z.string().max(200).optional(),
});

export const listJoinRequestsSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const transferOwnershipSchema = z.object({
  leaderUid:    z.string().min(1).optional(),
  g12LeaderUid: z.string().min(1).optional(),
}).refine(data => data.leaderUid !== undefined || data.g12LeaderUid !== undefined, {
  message: 'At least one of leaderUid or g12LeaderUid must be provided.',
});
