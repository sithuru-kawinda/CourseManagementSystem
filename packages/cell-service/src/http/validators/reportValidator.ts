import { z } from 'zod';

const attendanceEntrySchema = z.object({
  userUid: z.string().optional(),
  name:    z.string().min(1),
  status:  z.enum(['present', 'absent', 'new']),
  isNew:   z.boolean(),
});

export const fileReportSchema = z.object({
  date:                   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  didMeet:                z.boolean(),
  noMeetReason:           z.string().max(1000).nullable().optional(),
  leaderPresent:          z.boolean().default(true),
  conductedByIfAbsent:    z.string().max(200).nullable().optional(),
  location:               z.string().min(1).max(300).optional().default(''),
  timeStarted:            z.string().optional().default(''),
  timeEnded:              z.string().optional().default(''),
  language:               z.enum(['si', 'ta', 'en']).optional().default('en'),
  subjectDiscussed:       z.enum(['sunday_sermon', 'other']).optional().default('sunday_sermon'),
  otherSubjectReason:     z.string().max(500).nullable().optional(),
  cellType:               z.enum(['g12', 'care', 'children', 'outreach']).optional(),
  g12LeaderUid:           z.string().optional().default(''),
  immediateG12LeaderText: z.string().max(200).nullable().optional(),
  attendance:             z.array(attendanceEntrySchema).optional().default([]),
  // Three-value enum: yes | no | future (replaces boolean)
  contactedAbsentees:     z.enum(['yes', 'no', 'future']).optional().default('no'),
  absenteeNotes:          z.string().max(1000).nullable().optional(),
  additionalVisitors:     z.number().int().min(0).optional().default(0),
  childrenCount:          z.number().int().min(0).optional().default(0),
  satisfactionRate:       z.number().int().min(1).max(6).optional().default(3),
  additionalInfo:         z.string().max(2000).nullable().optional(),
  // Up to 10 photo URLs uploaded beforehand via POST /cells/:id/report-photos
  photoUrls:              z.array(z.string().url()).max(10).optional().default([]),
  clientReqId:            z.string().uuid('X-Idempotency-Key must be a UUID'),
});

export const voidReportSchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * PATCH /cells/:id/reports/:rid — update a cell report within 24 hours of filing.
 * All fields optional (PATCH semantics). clientReqId is excluded — it is immutable.
 */
export const updateReportSchema = z.object({
  date:                   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  didMeet:                z.boolean().optional(),
  noMeetReason:           z.string().max(1000).nullable().optional(),
  leaderPresent:          z.boolean().optional(),
  conductedByIfAbsent:    z.string().max(200).nullable().optional(),
  location:               z.string().min(1).max(300).optional(),
  timeStarted:            z.string().optional(),
  timeEnded:              z.string().optional(),
  language:               z.enum(['si', 'ta', 'en']).optional(),
  subjectDiscussed:       z.enum(['sunday_sermon', 'other']).optional(),
  otherSubjectReason:     z.string().max(500).nullable().optional(),
  cellType:               z.enum(['g12', 'care', 'children', 'outreach']).optional(),
  g12LeaderUid:           z.string().optional(),
  immediateG12LeaderText: z.string().max(200).nullable().optional(),
  attendance:             z.array(z.object({
    userUid: z.string().optional(),
    name:    z.string().min(1),
    status:  z.enum(['present', 'absent', 'new']),
    isNew:   z.boolean(),
  })).optional(),
  contactedAbsentees:     z.enum(['yes', 'no', 'future']).optional(),
  absenteeNotes:          z.string().max(1000).nullable().optional(),
  additionalVisitors:     z.number().int().min(0).optional(),
  childrenCount:          z.number().int().min(0).optional(),
  satisfactionRate:       z.number().int().min(1).max(6).optional(),
  additionalInfo:         z.string().max(2000).nullable().optional(),
  photoUrls:              z.array(z.string().url()).max(10).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

export const listReportsSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  from:   z.string().optional(),
  to:     z.string().optional(),
  voided: z.string().transform(v => v === 'true').optional(),
});
