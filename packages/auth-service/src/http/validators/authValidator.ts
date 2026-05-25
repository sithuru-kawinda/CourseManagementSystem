import { z } from 'zod';

const passwordRule = z
  .string()
  .min(10,             'Password must be at least 10 characters.')
  .regex(/[A-Z]/,      'Password must contain an uppercase letter.')
  .regex(/[a-z]/,      'Password must contain a lowercase letter.')
  .regex(/[0-9]/,      'Password must contain a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character.');

export const registerSchema = z.object({
  firstName:         z.string().min(1).max(100),
  lastName:          z.string().min(1).max(100),
  email:             z.string().email(),
  password:          passwordRule,
  preferredLanguage: z.enum(['en', 'si', 'ta']).default('en').optional(),
});

export const passwordResetSchema = z.object({
  email: z.string().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp:   z.string().length(6).regex(/^\d{6}$/, 'OTP must be a 6-digit number.'),
});

export const trackFailureSchema = z.object({
  email: z.string().email(),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().email(),
  otp:   z.string().length(6).regex(/^\d{6}$/, 'OTP must be a 6-digit number.'),
});

export const federatedSignInSchema = z.object({
  idToken:           z.string().min(1),
  preferredLanguage: z.enum(['en', 'si', 'ta']).default('en'),
});

export const verifyTokenInternalSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken:  z.string().min(1),
});

// Apple web OAuth callback — body is application/x-www-form-urlencoded sent by Apple
// `user` is a JSON string sent by Apple ONLY on the user's first sign-in
export const appleCallbackSchema = z.object({
  code:  z.string().min(1, 'Authorization code is required.'),
  state: z.string().optional(),
  user:  z.string().optional(),
});
