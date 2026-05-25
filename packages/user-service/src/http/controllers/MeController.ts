import { Request, Response, NextFunction }         from 'express';
import { AuthenticatedRequest }                     from '@shared/auth-middleware';
import { fromZodError }                             from '@shared/errors';
import { sendSuccess }                              from '@shared/response';
import { GetMeUseCase }                             from '../../application/use-cases/GetMeUseCase';
import { UpdateProfileUseCase }                     from '../../application/use-cases/UpdateProfileUseCase';
import { ChangePasswordUseCase }                    from '../../application/use-cases/ChangePasswordUseCase';
import { UploadAvatarUseCase }                      from '../../application/use-cases/UploadAvatarUseCase';
import { UploadQualificationUseCase }               from '../../application/use-cases/UploadQualificationUseCase';
import { RegisterFcmTokenUseCase }                  from '../../application/use-cases/RegisterFcmTokenUseCase';
import { DeregisterFcmTokenUseCase }                from '../../application/use-cases/DeregisterFcmTokenUseCase';
import { UpdateNotificationPreferencesUseCase }     from '../../application/use-cases/UpdateNotificationPreferencesUseCase';
import { LinkProviderUseCase }                      from '../../application/use-cases/LinkProviderUseCase';
import { UnlinkProviderUseCase }                    from '../../application/use-cases/UnlinkProviderUseCase';
import {
  updateProfileSchema, changePasswordSchema, fcmTokenSchema,
  notificationPreferencesSchema, linkProviderSchema,
} from '../validators/meValidator';

export class MeController {
  constructor(
    private readonly getMe:                GetMeUseCase,
    private readonly updateProfile:        UpdateProfileUseCase,
    private readonly changePassword:       ChangePasswordUseCase,
    private readonly uploadAvatar:         UploadAvatarUseCase,
    private readonly uploadQualification:  UploadQualificationUseCase,
    private readonly registerFcmToken:     RegisterFcmTokenUseCase,
    private readonly deregisterFcmToken:   DeregisterFcmTokenUseCase,
    private readonly updateNotifPrefs:     UpdateNotificationPreferencesUseCase,
    private readonly linkProvider:         LinkProviderUseCase,
    private readonly unlinkProvider:       UnlinkProviderUseCase,
  ) {}

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      const user    = await this.getMe.execute(uid);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  patchProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const user    = await this.updateProfile.execute({ uid, ...parsed.data });
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  postAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      const user    = await this.uploadAvatar.execute({
        uid,
        buffer:   req.file!.buffer,
        mimeType: req.file!.mimetype,
      });
      sendSuccess(res, { profilePhotoUrl: user.profilePhotoUrl });
    } catch (err) { next(err); }
  };

  postQualification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      // Stateless upload — returns fileUrl only. No profile write.
      // Frontend stores this URL and includes it in qualifications[].fileUrl
      // when calling PATCH /me to save the full qualifications list.
      const result = await this.uploadQualification.execute({
        uid,
        buffer:   req.file!.buffer,
        mimeType: req.file!.mimetype,
      });
      sendSuccess(res, { fileUrl: result.fileUrl });
    } catch (err) { next(err); }
  };

  postChangePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      await this.changePassword.execute({ uid, ...parsed.data });
      res.status(204).send();
    } catch (err) { next(err); }
  };

  postFcmToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = fcmTokenSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      await this.registerFcmToken.execute(uid, parsed.data.token);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  deleteFcmToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = fcmTokenSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      await this.deregisterFcmToken.execute(uid, parsed.data.token);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  patchNotificationPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = notificationPreferencesSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const prefs   = await this.updateNotifPrefs.execute(uid, parsed.data);
      sendSuccess(res, prefs);
    } catch (err) { next(err); }
  };

  postLinkProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = linkProviderSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const providers = await this.linkProvider.execute(uid, parsed.data.provider, parsed.data.idToken);
      sendSuccess(res, { providers });
    } catch (err) { next(err); }
  };

  deleteUnlinkProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      const providers = await this.unlinkProvider.execute(uid, req.params.provider);
      sendSuccess(res, { providers });
    } catch (err) { next(err); }
  };
}
