'use strict';
const c = require('../postman/CMP_Backend.postman_collection.json');

function norm(u) {
  return u
    .replace('{{baseUrl}}', '')
    .replace(/\{\{[^}]+\}\}/g, ':id')
    // Only replace literal provider names when they follow "federated/" or "providers/"
    .replace(/(federated|providers)\/(google|apple)/, '$1/:provider')
    .split('?')[0];
}

function collectPM(items) {
  const out = new Set();
  for (const item of items) {
    if (item.request) {
      out.add(item.request.method + ' ' + norm(item.request.url && item.request.url.raw || ''));
    } else if (item.item) {
      collectPM(item.item).forEach(x => out.add(x));
    }
  }
  return out;
}
const pm = collectPM(c.item);

const routes = [
  // Auth
  ['POST','/auth/register'],
  ['POST','/auth/password-reset'],
  ['POST','/auth/password-reset/verify'],
  ['POST','/auth/track-failure'],
  ['POST','/auth/logout'],
  ['POST','/auth/federated/:provider'],
  ['GET', '/auth/apple/init'],
  ['POST','/auth/apple/callback'],
  ['POST','/auth/apple/refresh'],
  ['POST','/auth/apple/revoke'],
  // User-me
  ['GET',   '/me'],
  ['PATCH', '/me'],
  ['POST',  '/me/avatar'],
  ['POST',  '/me/change-password'],
  ['POST',  '/me/fcm-token'],
  ['DELETE','/me/fcm-token'],
  ['PATCH', '/me/notifications/preferences'],
  ['POST',  '/me/providers/link'],
  ['DELETE','/me/providers/:provider'],
  // Users
  ['POST',  '/users'],
  ['GET',   '/users'],
  ['GET',   '/users/:id'],
  ['POST',  '/users/:id/suspend'],
  ['POST',  '/users/:id/reactivate'],
  ['PATCH', '/users/:id/roles'],
  ['POST',  '/users/:id/promote'],
  // Super Admin
  ['GET',   '/super-admin/admins'],
  ['POST',  '/super-admin/admins'],
  ['GET',   '/super-admin/admins/:id'],
  ['POST',  '/super-admin/admins/:id/suspend'],
  ['POST',  '/super-admin/admins/:id/reactivate'],
  ['DELETE','/super-admin/admins/:id'],
  ['POST',  '/super-admin/users/:id/make-admin'],
  // Course
  ['GET',   '/courses'],
  ['GET',   '/courses/:id'],
  ['POST',  '/courses'],
  ['PATCH', '/courses/:id'],
  ['POST',  '/courses/:id/publish'],
  ['POST',  '/courses/:id/unpublish'],
  ['POST',  '/courses/:id/archive'],
  ['POST',  '/courses/:id/restore'],
  ['DELETE','/courses/:id'],
  ['GET',   '/courses/:id/semesters'],
  ['POST',  '/courses/:id/semesters'],
  ['GET',   '/courses/:id/batches'],
  ['POST',  '/courses/:id/batches'],
  ['GET',   '/batches/:id'],
  ['PATCH', '/batches/:id'],
  ['POST',  '/batches/:id/open'],
  ['POST',  '/batches/:id/close'],
  // Semester / Subject / Lesson
  ['PATCH', '/semesters/:id'],
  ['DELETE','/semesters/:id'],
  ['GET',   '/semesters/:id/subjects'],
  ['POST',  '/semesters/:id/subjects'],
  ['PATCH', '/subjects/:id'],
  ['DELETE','/subjects/:id'],
  ['GET',   '/subjects/:id/lessons'],
  ['POST',  '/subjects/:id/lessons'],
  ['PATCH', '/lessons/:id'],
  ['DELETE','/lessons/:id'],
  // Enrollment
  ['POST','/courses/:id/enroll'],
  ['GET', '/me/enrollments'],
  ['GET', '/enrollments/mine'],
  ['POST','/enrollments'],
  ['POST','/enrollments/:id/withdraw'],
  ['GET', '/admin/registrations'],
  ['POST','/admin/registrations/bulk-approve'],
  ['POST','/admin/registrations/:id/approve'],
  ['POST','/admin/registrations/:id/reject'],
  ['GET', '/admin/enrollments'],
  ['GET', '/enrollments'],
  ['POST','/admin/enrollments/:id/approve'],
  ['POST','/enrollments/:id/approve'],
  ['POST','/admin/enrollments/:id/reject'],
  ['POST','/enrollments/:id/reject'],
  // Role Requests
  ['POST','/role-requests'],
  ['GET', '/role-requests/mine'],
  ['GET', '/role-requests'],
  ['GET', '/role-requests/:id/qualification'],
  ['GET', '/role-requests/:id'],
  ['POST','/role-requests/:id/approve'],
  ['POST','/role-requests/:id/reject'],
  // Progress
  ['POST','/progress/subjects/:id/complete'],
  ['POST','/progress/subjects/:id/access'],
  ['GET', '/me/progress/courses/:id'],
  ['GET', '/me/progress/subjects/:id'],
  ['GET', '/admin/progress/courses/:id'],
  // Storage
  ['POST',  '/subjects/:id/attachments'],
  ['POST',  '/subjects/:id/images'],
  ['GET',   '/attachments/:id/download-url'],
  ['DELETE','/attachments/:id'],
  // Notifications
  ['GET', '/me/notifications'],
  ['POST','/me/notifications/:id/read'],
  ['POST','/me/notifications/read-all'],
  // Audit
  ['GET','/audit-log'],
  ['GET','/users/:id/audit-log'],
  // Cell
  ['GET',  '/cells/mine'],
  ['GET',  '/cells'],
  ['POST', '/cells'],
  ['GET',  '/cells/:id'],
  ['PATCH','/cells/:id'],
  ['POST', '/cells/:id/archive'],
  ['POST', '/cells/:id/members'],
  ['DELETE','/cells/:id/members/:id'],
  ['POST', '/cells/:id/join-requests'],
  ['GET',  '/cells/:id/join-requests'],
  ['POST', '/cells/:id/join-requests/:id/approve'],
  ['POST', '/cells/:id/join-requests/:id/reject'],
  ['POST', '/cells/:id/report-photos'],
  ['GET',  '/cells/:id/reports'],
  ['POST', '/cells/:id/reports'],
  ['GET',  '/cells/:id/reports/:id'],
  ['POST', '/cells/:id/reports/:id/void'],
  // Analytics
  ['GET','/analytics/cells/weekly'],
  ['GET','/analytics/attendance'],
  ['GET','/analytics/meeting-types'],
  ['GET','/analytics/growth'],
  ['GET','/analytics/participation'],
  ['GET','/analytics/cells-weekly/export'],
  ['GET','/analytics/attendance/export'],
  ['GET','/analytics/meeting-types/export'],
  ['GET','/analytics/growth/export'],
  ['GET','/analytics/participation/export'],
  // Health
  ['GET','http://localhost:3000/healthz'],
  ['GET','http://localhost:3000/readyz'],
  ['GET','http://localhost:3001/healthz'],
  ['GET','http://localhost:3002/healthz'],
  ['GET','http://localhost:3003/healthz'],
  ['GET','http://localhost:3004/healthz'],
  ['GET','http://localhost:3005/healthz'],
  ['GET','http://localhost:3006/healthz'],
  ['GET','http://localhost:3007/healthz'],
  ['GET','http://localhost:3008/healthz'],
  ['GET','http://localhost:3009/healthz'],
];

let ok = 0, fail = 0;
routes.forEach(function(r) {
  const key = r[0] + ' ' + r[1];
  if (pm.has(key)) {
    ok++;
  } else {
    console.log('MISSING: ' + key);
    fail++;
  }
});

console.log('');
console.log('Backend routes audited : ' + routes.length);
console.log('Present in collection  : ' + ok);
console.log('Missing                : ' + fail);
console.log('');
console.log(fail === 0
  ? 'COMPLETE - every API is in the Postman collection'
  : 'GAPS: ' + fail + ' route(s) missing');
