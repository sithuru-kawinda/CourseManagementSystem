import { Request, Response, NextFunction } from 'express';
import { getAuth }                         from 'firebase-admin/auth';
import { createHttpError }                 from '@shared/errors';

export type Role = 'member' | 'student' | 'leader' | 'g12' | 'admin' | 'super_admin';

export interface Principal {
  uid:   string;
  email: string;
  role:  Role;   // primary role (for backward compat — use roles[] for authorization)
  roles: Role[]; // full additive roles array e.g. ["member","student","leader"]
}

export interface AuthenticatedRequest extends Request {
  principal: Principal;
}

export interface AuthenticateOptions {
  /**
   * When true, the email-verification gate is bypassed.
   * Use on routes that must remain accessible before the user verifies their
   * email address (e.g. POST /auth/logout, POST /auth/apple/revoke).
   */
  allowUnverified?: boolean;
}

// ── authenticate ─────────────────────────────────────────────────────────────

export function authenticate(options: AuthenticateOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next(createHttpError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    }

    const token = authHeader.slice(7);

    try {
      const decoded = await getAuth().verifyIdToken(token, true); // checkRevoked=true

      // decoded.role  — top-level claim written by setCustomUserClaims (may lag on brand-new
      //                 federated accounts before Firebase propagates the write globally).
      // fbClaims.role — written by developerClaims in createCustomToken; always present in the
      //                 very first ID token issued via signInWithCustomToken.
      const fbClaims = (decoded.firebase as Record<string, unknown> | undefined)?.['claims'] as Record<string, unknown> | undefined;
      const role     = (decoded.role ?? fbClaims?.['role']) as Role | undefined;

      if (!role) {
        return next(createHttpError(401, 'INVALID_TOKEN', 'Token is missing role claim.'));
      }

      const roles = ((decoded.roles ?? fbClaims?.['roles']) as Role[] | undefined) ?? [role as Role];

      // Email-verification gate — reject unverified users unless the route explicitly
      // opts out (allowUnverified: true). Federated users (Google/Apple) always have
      // email_verified=true in Firebase so they are never affected by this check.
      if (!options.allowUnverified && decoded.email_verified === false) {
        return next(createHttpError(
          403,
          'EMAIL_NOT_VERIFIED',
          'Please verify your email address before continuing. Check your inbox or resend via POST /auth/resend-verification.',
        ));
      }

      (req as AuthenticatedRequest).principal = {
        uid:   decoded.uid,
        email: decoded.email ?? '',
        role,
        roles,
      };

      next();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;

      if (code === 'auth/id-token-revoked') {
        return next(createHttpError(401, 'TOKEN_REVOKED', 'Session has been revoked.'));
      }
      if (code === 'auth/id-token-expired') {
        return next(createHttpError(401, 'TOKEN_EXPIRED', 'Token has expired.'));
      }

      return next(createHttpError(401, 'INVALID_TOKEN', 'Token could not be verified.'));
    }
  };
}

// ── authorize ────────────────────────────────────────────────────────────────

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const principal = (req as AuthenticatedRequest).principal;

    if (!principal) {
      return next(createHttpError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    }

    // super_admin inherits all admin permissions
    const effectiveRoles: Role[] = principal.roles.includes('super_admin')
      ? ([...new Set([...principal.roles, 'admin'])] as Role[])
      : principal.roles;

    const allowed = roles.some(r => effectiveRoles.includes(r));

    if (!allowed) {
      return next(
        createHttpError(
          403,
          'FORBIDDEN',
          `Role '${principal.role}' is not permitted to perform this action.`,
        ),
      );
    }

    next();
  };
}

// ── mustBeOwnerOrAdmin ───────────────────────────────────────────────────────

export function mustBeOwnerOrAdmin(getResourceUid: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const principal   = (req as AuthenticatedRequest).principal;
    const resourceUid = getResourceUid(req);

    if (!resourceUid) return next();

    const isOwner = principal.uid === resourceUid;
    const isAdmin = principal.roles.includes('admin') || principal.roles.includes('super_admin');

    if (!isOwner && !isAdmin) {
      return next(
        createHttpError(403, 'FORBIDDEN', 'You do not have access to this resource.'),
      );
    }

    next();
  };
}
