import { z } from 'zod';

export const rejectSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

// POST /admin/enrollments/:id/approve — optional approval note shown in email
export const approveEnrollmentSchema = z.object({
  note: z.string().min(1).max(500).optional(),
});

export const bulkApproveSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export const listSchema = z.object({
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  cursor:   z.string().optional(),
  status:   z.enum(['pending', 'approved', 'rejected', 'withdrawn']).optional(),
  courseId: z.string().optional(),
});

// V2: POST /enrollments {courseId, batchId}
export const enrollV2Schema = z.object({
  courseId: z.string().min(1),
  batchId:  z.string().optional(), // optional until batch-keyed enrollment is fully wired
});

export const internalCreateRegistrationSchema = z.object({
  studentUid: z.string().min(1),
  email:      z.string().email(),
  firstName:  z.string().min(1),
  lastName:   z.string().min(1),
});
