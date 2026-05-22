export const config = {
  serviceName:          process.env.SERVICE_NAME              ?? 'enrollment-service',
  port:                 Number(process.env.PORT                ?? 3004),
  nodeEnv:              process.env.NODE_ENV                   ?? 'development',
  internalServiceKey:   process.env.INTERNAL_SERVICE_KEY       ?? '',
  serviceUserUrl:       process.env.SERVICE_USER_URL           ?? 'http://localhost:3002',
  serviceCourseUrl:     process.env.SERVICE_COURSE_URL         ?? 'http://localhost:3003',
  cooloffHours:         Number(process.env.ENROLLMENT_REJECTION_COOLOFF_HOURS ?? 24),
  storageBucket:        process.env.FIREBASE_STORAGE_BUCKET    ?? '',
  appUrl:               process.env.APP_URL                    ?? 'https://cms.bethelnet.au/login',
} as const;
