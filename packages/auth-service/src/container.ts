import { OutboxEventPublisher }              from '@shared/events';
import { FirestoreLoginAttemptsRepository }            from './infrastructure/repositories/FirestoreLoginAttemptsRepository';
import { FirestoreOtpRepository }                      from './infrastructure/repositories/FirestoreOtpRepository';
import { FirestoreEmailVerificationOtpRepository }     from './infrastructure/repositories/FirestoreEmailVerificationOtpRepository';
import { EmailClient }                      from './infrastructure/clients/EmailClient';
import { UserServiceClient }                from './infrastructure/clients/UserServiceClient';
import { GoogleAuthClient }                 from './infrastructure/clients/GoogleAuthClient';
import { AppleAuthClient }                  from './infrastructure/clients/AppleAuthClient';
import { RegisterUseCase }                  from './application/use-cases/RegisterUseCase';
import { LogoutUseCase }                    from './application/use-cases/LogoutUseCase';
import { TrackLoginAttemptsUseCase }        from './application/use-cases/TrackLoginAttemptsUseCase';
import { RequestPasswordResetUseCase }      from './application/use-cases/RequestPasswordResetUseCase';
import { VerifyOtpAndResetUseCase }         from './application/use-cases/VerifyOtpAndResetUseCase';
import { FederatedSignInUseCase }           from './application/use-cases/FederatedSignInUseCase';
import { AppleWebCallbackUseCase }          from './application/use-cases/AppleWebCallbackUseCase';
import { AppleRevokeUseCase }               from './application/use-cases/AppleRevokeUseCase';
import { ResendVerificationUseCase }        from './application/use-cases/ResendVerificationUseCase';
import { VerifyEmailOtpUseCase }            from './application/use-cases/VerifyEmailOtpUseCase';
import { AuthController }                   from './http/controllers/AuthController';

const attemptsRepo  = new FirestoreLoginAttemptsRepository();
const otpRepo       = new FirestoreOtpRepository();
const emailVerifOtpRepo = new FirestoreEmailVerificationOtpRepository();
const emailClient   = new EmailClient();
const userClient    = new UserServiceClient();
const googleClient  = new GoogleAuthClient();
const appleClient   = new AppleAuthClient();
const outbox        = new OutboxEventPublisher();

const registerUseCase        = new RegisterUseCase(userClient, outbox);
const logoutUseCase          = new LogoutUseCase();
const trackAttemptsUseCase   = new TrackLoginAttemptsUseCase(attemptsRepo);
const requestResetUseCase    = new RequestPasswordResetUseCase(otpRepo, emailClient);
const verifyOtpUseCase       = new VerifyOtpAndResetUseCase(otpRepo);
const federatedSignInUseCase = new FederatedSignInUseCase(googleClient, appleClient, outbox);
const appleCallbackUseCase      = new AppleWebCallbackUseCase(appleClient, outbox);
const appleRevokeUseCase        = new AppleRevokeUseCase(appleClient);
const resendVerificationUseCase = new ResendVerificationUseCase(emailVerifOtpRepo, emailClient);
const verifyEmailOtpUseCase     = new VerifyEmailOtpUseCase(emailVerifOtpRepo);

export const container = {
  authController: new AuthController(
    registerUseCase,
    logoutUseCase,
    trackAttemptsUseCase,
    requestResetUseCase,
    verifyOtpUseCase,
    federatedSignInUseCase,
    appleCallbackUseCase,
    appleRevokeUseCase,
    resendVerificationUseCase,
    verifyEmailOtpUseCase,
    appleClient,
  ),
};
