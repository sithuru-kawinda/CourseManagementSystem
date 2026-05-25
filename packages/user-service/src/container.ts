import { OutboxEventPublisher }    from '@shared/events';
import { FirestoreUserRepository } from './infrastructure/repositories/FirestoreUserRepository';
import { FirebaseAuthClient }      from './infrastructure/clients/FirebaseAuthClient';
import { AuthServiceClient }       from './infrastructure/clients/AuthServiceClient';
import { GetMeUseCase }            from './application/use-cases/GetMeUseCase';
import { UpdateProfileUseCase }    from './application/use-cases/UpdateProfileUseCase';
import { UploadAvatarUseCase }         from './application/use-cases/UploadAvatarUseCase';
import { UploadQualificationUseCase }  from './application/use-cases/UploadQualificationUseCase';
import { ChangePasswordUseCase }   from './application/use-cases/ChangePasswordUseCase';
import { GetUsersUseCase }         from './application/use-cases/GetUsersUseCase';
import { GetUserByIdUseCase }      from './application/use-cases/GetUserByIdUseCase';
import { SuspendUserUseCase }      from './application/use-cases/SuspendUserUseCase';
import { ReactivateUserUseCase }   from './application/use-cases/ReactivateUserUseCase';
import { CreateAdminUseCase }      from './application/use-cases/CreateAdminUseCase';
import { DeleteAdminUseCase }      from './application/use-cases/DeleteAdminUseCase';
import { PromoteToAdminUseCase }   from './application/use-cases/PromoteToAdminUseCase';
import { CheckEmailExistsUseCase } from './application/use-cases/CheckEmailExistsUseCase';
import { ApproveUserUseCase }      from './application/use-cases/ApproveUserUseCase';
import { AddRoleUseCase }               from './application/use-cases/AddRoleUseCase';
import { RemoveRoleUseCase }            from './application/use-cases/RemoveRoleUseCase';
import { CreateUserDirectlyUseCase }    from './application/use-cases/CreateUserDirectlyUseCase';
import { PromoteMemberUseCase }         from './application/use-cases/PromoteMemberUseCase';
import { DemoteMemberUseCase }         from './application/use-cases/DemoteMemberUseCase';
import { DeleteUserUseCase }           from './application/use-cases/DeleteUserUseCase';
import { RegisterFcmTokenUseCase }              from './application/use-cases/RegisterFcmTokenUseCase';
import { DeregisterFcmTokenUseCase }            from './application/use-cases/DeregisterFcmTokenUseCase';
import { UpdateNotificationPreferencesUseCase } from './application/use-cases/UpdateNotificationPreferencesUseCase';
import { LinkProviderUseCase }                  from './application/use-cases/LinkProviderUseCase';
import { UnlinkProviderUseCase }                from './application/use-cases/UnlinkProviderUseCase';
import { MeController }                         from './http/controllers/MeController';
import { UsersController }         from './http/controllers/UsersController';
import { SuperAdminController }    from './http/controllers/SuperAdminController';
import { InternalController }      from './http/controllers/InternalController';

// Infrastructure
const userRepo      = new FirestoreUserRepository();
const authClient    = new FirebaseAuthClient();
const authSvcClient = new AuthServiceClient();
const outbox        = new OutboxEventPublisher();

// Use cases
const getMe            = new GetMeUseCase(userRepo);
const updateProfile    = new UpdateProfileUseCase(userRepo);
const changePassword   = new ChangePasswordUseCase(userRepo, authClient);
const uploadAvatar         = new UploadAvatarUseCase(userRepo);
const uploadQualification  = new UploadQualificationUseCase();  // stateless — no repo needed
const getUsers         = new GetUsersUseCase(userRepo);
const getUserById      = new GetUserByIdUseCase(userRepo);
const suspendUser      = new SuspendUserUseCase(userRepo, authClient, outbox);
const reactivate       = new ReactivateUserUseCase(userRepo, authClient);
const createAdmin      = new CreateAdminUseCase(userRepo, authClient, outbox);
const deleteAdmin      = new DeleteAdminUseCase(userRepo, authClient);
const promoteToAdmin   = new PromoteToAdminUseCase(userRepo, authClient, outbox);
const checkEmail       = new CheckEmailExistsUseCase(userRepo);
const approveUser      = new ApproveUserUseCase(userRepo, authClient);
const addRole              = new AddRoleUseCase(userRepo, authClient);
const removeRole           = new RemoveRoleUseCase(userRepo, authClient);
const createUserDirectly   = new CreateUserDirectlyUseCase(userRepo, authClient, outbox);
const promoteMember        = new PromoteMemberUseCase(userRepo, authClient, outbox);
const demoteMember         = new DemoteMemberUseCase(userRepo, authClient, outbox);
const deleteUser           = new DeleteUserUseCase(userRepo, authClient);
const registerFcm      = new RegisterFcmTokenUseCase(userRepo);
const deregisterFcm    = new DeregisterFcmTokenUseCase(userRepo);
const updateNotifPrefs = new UpdateNotificationPreferencesUseCase(userRepo);
const linkProvider     = new LinkProviderUseCase(userRepo, authSvcClient);
const unlinkProvider   = new UnlinkProviderUseCase(userRepo);

// Controllers
export const container = {
  meController:         new MeController(
    getMe, updateProfile, changePassword, uploadAvatar, uploadQualification,
    registerFcm, deregisterFcm, updateNotifPrefs,
    linkProvider, unlinkProvider,
  ),
  usersController:      new UsersController(getUsers, getUserById, suspendUser, reactivate, addRole, removeRole, createUserDirectly, promoteMember, demoteMember, deleteUser),
  superAdminController: new SuperAdminController(createAdmin, deleteAdmin, getUsers, getUserById, suspendUser, reactivate, promoteToAdmin),
  internalController:   new InternalController(checkEmail, approveUser, getUsers, addRole, removeRole, getUserById),
};
