export const config = {
  serviceName:        process.env.SERVICE_NAME            ?? 'cell-service',
  port:               Number(process.env.PORT             ?? 3009),
  nodeEnv:            process.env.NODE_ENV                ?? 'development',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY   ?? '',
  storageBucket:      process.env.FIREBASE_STORAGE_BUCKET ?? '',
  serviceUserUrl:     process.env.SERVICE_USER_URL        ?? 'http://localhost:3002',
} as const;
