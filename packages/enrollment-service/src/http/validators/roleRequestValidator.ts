import { z } from 'zod';

// Fields arrive as strings from multipart/form-data — no JSON body parsing
export const createRoleRequestSchema = z.object({
  requestedRole:      z.literal('student'),
  firstName:          z.string().min(1, 'First name is required').max(100).trim(),
  lastName:           z.string().min(1, 'Last name is required').max(100).trim(),
  phoneNumber:        z.string().min(5, 'Phone number is required').max(30).trim(),
  email:              z.string().email('Must be a valid email address'),
  dateOfBirth:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  gender:             z.enum(['male', 'female', 'other']),
  address:            z.string().min(1, 'Address is required').max(500).trim(),
  qualificationTitle: z.string().min(1, 'Qualification title is required').max(200).trim(),
});

export const decideRoleRequestSchema = z.object({
  note: z.string().max(500).optional(),
});

export const listRoleRequestsSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});
