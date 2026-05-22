export const config = {
  serviceName:        process.env.SERVICE_NAME     ?? 'auth-service',
  port:               Number(process.env.PORT      ?? 3001),
  nodeEnv:            process.env.NODE_ENV         ?? 'development',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY ?? '',
  serviceUserUrl:     process.env.SERVICE_USER_URL ?? 'http://localhost:3002',
  serviceEnrollUrl:   process.env.SERVICE_ENROLLMENT_URL ?? 'http://localhost:3004',
  firebaseWebApiKey:  process.env.FIREBASE_WEB_API_KEY ?? '',
  smtpHost:           process.env.SMTP_HOST  ?? 'smtp.gmail.com',
  smtpPort:           Number(process.env.SMTP_PORT ?? 587),
  smtpUser:           process.env.SMTP_USER  ?? '',
  smtpPass:           process.env.SMTP_PASS  ?? '',
  // Federated OAuth — Google
  googleClientId:     process.env.GOOGLE_CLIENT_ID  ?? '',
  // Federated OAuth — Apple (SDK flow: id_token verification)
  appleClientId:      process.env.APPLE_CLIENT_ID   ?? '',
  // Federated OAuth — Apple (web OAuth flow: code exchange)
  // APPLE_PRIVATE_KEY may have literal \n in .env — normalise to real newlines
  appleTeamId:        process.env.APPLE_TEAM_ID     ?? '',
  appleKeyId:         process.env.APPLE_KEY_ID      ?? '',
  applePrivateKey:    (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  appleRedirectUri:   process.env.APPLE_REDIRECT_URI ?? '',
  // JWT secret for signing state tokens (CSRF protection in web OAuth)
  jwtSecret:          process.env.JWT_SECRET         ?? '',
  // URL to redirect the browser back to after Apple callback processing
  frontendUrl:        process.env.FRONTEND_URL        ?? 'https://cms.bethelnet.au',
} as const;
