import express    from 'express';
import helmet     from 'helmet';
import cors       from 'cors';
import { Router } from 'express';
import { httpLogger }   from '@shared/logger';
import { requestId }    from './middleware/requestId';
import { generalLimiter, authLimiter } from './middleware/rateLimiter';
import {
  authProxy, userProxy, courseProxy, enrollProxy,
  progressProxy, storageProxy, notifyProxy, auditProxy, cellProxy, analyticsProxy,
} from './proxy/serviceProxy';
import { config } from './config';

export const app = express();

app.use(helmet());
app.use(cors({
  origin:  config.allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-Idempotency-Key'],
}));
app.use(requestId);
app.use(httpLogger);
app.use(generalLimiter);

// Health probes — gateway is a pure proxy, no Firestore connection
const gatewayHealthRouter = Router();
gatewayHealthRouter.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: process.env.SERVICE_NAME ?? 'gateway' });
});
gatewayHealthRouter.get('/readyz', (_req, res) => {
  res.json({ status: 'ready' });
});
app.use(gatewayHealthRouter);

// Block internal routes — never expose to clients
app.use('/api/v1/internal', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

// Auth routes (stricter rate limit)
app.use('/api/v1/auth', authLimiter, authProxy);

// /me sub-routes — order matters: specific prefixes before the generic /me catch-all
// /me/notifications/preferences must precede /me/notifications to reach user-service, not notification-service
app.use('/api/v1/me/notifications/preferences', userProxy);
app.use('/api/v1/me/notifications', notifyProxy);
app.use('/api/v1/me/enrollments',   enrollProxy);
app.use('/api/v1/me/progress',      progressProxy);
app.use('/api/v1/me',                          userProxy);
app.use('/api/v1/users/:uid/audit-log',        auditProxy);  // must precede generic /users → userProxy
app.use('/api/v1/users',                       userProxy);
app.use('/api/v1/super-admin',                 userProxy);

// Course enroll must come before the generic /courses catch-all
app.use('/api/v1/courses/:id/enroll', enrollProxy);
app.use('/api/v1/courses',            courseProxy);
app.use('/api/v1/semesters',          courseProxy);

// Subject sub-routes — specific paths must come before the generic /subjects catch-all
app.use('/api/v1/subjects/:id/lessons',     courseProxy);
app.use('/api/v1/subjects/:id/attachments', storageProxy);
app.use('/api/v1/subjects/:id/images',      storageProxy);
app.use('/api/v1/subjects',                 courseProxy);
app.use('/api/v1/lessons',                  courseProxy);

// Role Request routes — V2
app.use('/api/v1/role-requests', enrollProxy);

// Batch routes — V2
app.use('/api/v1/batches', courseProxy);

// Enrollment routes
app.use('/api/v1/enrollments',         enrollProxy);
app.use('/api/v1/admin/registrations', enrollProxy);
app.use('/api/v1/admin/enrollments',   enrollProxy);

// Progress routes
app.use('/api/v1/progress',       progressProxy);
app.use('/api/v1/admin/progress', progressProxy);

// Storage routes
app.use('/api/v1/attachments', storageProxy);

// Audit routes
app.use('/api/v1/audit-log', auditProxy);

// Cell Service routes — V2
app.use('/api/v1/cells', cellProxy);

// Analytics Service routes — V2
app.use('/api/v1/analytics', analyticsProxy);

// Catch-all: return JSON 404 so clients never receive an HTML error page
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});
