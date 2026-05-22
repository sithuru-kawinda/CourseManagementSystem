import express           from 'express';
import helmet            from 'helmet';
import { errorHandler }  from '@shared/errors';
import { httpLogger }    from '@shared/logger';
import { healthRouter }  from '@shared/health';
import { authRouter }    from './http/routes/authRouter';

export const app = express();

app.use(helmet());
app.use(express.json());
// Apple sends POST /auth/apple/callback as application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);

app.use(healthRouter);
app.use(authRouter);

app.use(errorHandler);
