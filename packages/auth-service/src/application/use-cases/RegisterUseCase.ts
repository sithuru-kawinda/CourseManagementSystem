import { getAuth }              from 'firebase-admin/auth';
import { getFirestore }        from 'firebase-admin/firestore';
import { createHttpError }     from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { UserServiceClient }   from '../../infrastructure/clients/UserServiceClient';
import { config }              from '../../config';

export interface RegisterInput {
  firstName:          string;
  lastName:           string;
  email:              string;
  password:           string;
  preferredLanguage?: string;
}

export class RegisterUseCase {
  constructor(
    private readonly userClient: UserServiceClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: RegisterInput, requestId: string): Promise<{ uid: string }> {
    const exists = await this.userClient.emailExists(input.email);
    if (exists) throw createHttpError(409, 'EMAIL_EXISTS', 'Email address already registered.');

    let record;
    try {
      record = await getAuth().createUser({
        email:       input.email,
        password:    input.password,
        displayName: `${input.firstName} ${input.lastName}`,
      });
    } catch (authErr: unknown) {
      if ((authErr as { code?: string })?.code === 'auth/email-already-exists') {
        throw createHttpError(409, 'EMAIL_EXISTS', 'Email address already registered.');
      }
      throw authErr;
    }

    try {
      // V2: new users are active Members immediately — no approval queue
      await getAuth().setCustomUserClaims(record.uid, { role: 'member', roles: ['member'] });

      const now   = new Date().toISOString();
      const db    = getFirestore();
      const batch = db.batch();

      batch.set(db.collection('users').doc(record.uid), {
        email:             input.email,
        firstName:         input.firstName,
        lastName:          input.lastName,
        role:              'member',
        roles:             ['member'],
        status:            'approved',
        profilePhotoUrl:   null,
        preferredLanguage: input.preferredLanguage ?? 'en',
        createdAt:         now,
        updatedAt:         now,
        deletedAt:         null,
      });

      await this.outbox.publishWithBatch({
        type:    'user.registered',
        payload: {
          uid:       record.uid,
          email:     input.email,
          firstName: input.firstName,
          lastName:  input.lastName,
          password:  input.password,  // plain-text; used by notification-service to send welcome email
          appUrl:    config.appUrl,   // login link included in welcome email
        },
        requestId,
      }, batch);

      await batch.commit();
    } catch (err) {
      await getAuth().deleteUser(record.uid).catch(() => undefined);
      throw err;
    }

    return { uid: record.uid };
  }
}
