import { Router }              from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { handleAvatarUpload }         from '../middleware/avatarUpload';
import { handleQualificationUpload }  from '../middleware/qualificationUpload';
import { container }           from '../../container';

export const meRouter = Router();

// V2: /me routes are accessible to any authenticated role (member, student, leader, g12, admin, super_admin)
meRouter.get(  '/me',                 authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.meController.getProfile);
meRouter.patch('/me',                 authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.meController.patchProfile);
meRouter.post( '/me/avatar',          authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), handleAvatarUpload,        container.meController.postAvatar);
meRouter.post( '/me/qualification',   authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), handleQualificationUpload, container.meController.postQualification);
meRouter.post( '/me/change-password', authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.meController.postChangePassword);
meRouter.post(  '/me/fcm-token',                    authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.meController.postFcmToken);
meRouter.delete('/me/fcm-token',                    authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.meController.deleteFcmToken);
meRouter.patch( '/me/notifications/preferences',    authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.meController.patchNotificationPreferences);
meRouter.post(  '/me/providers/link',               authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.meController.postLinkProvider);
meRouter.delete('/me/providers/:provider',          authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.meController.deleteUnlinkProvider);
