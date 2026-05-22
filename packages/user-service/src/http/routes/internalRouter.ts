import { Router }       from 'express';
import { internalAuth } from '../middleware/internalAuth';
import { container }    from '../../container';

export const internalRouter = Router();

internalRouter.post('/internal/users/exists',  internalAuth, container.internalController.exists);
internalRouter.post('/internal/users/approve', internalAuth, container.internalController.approve);
internalRouter.get( '/internal/users/admins',  internalAuth, container.internalController.getAdmins);
internalRouter.post('/internal/users/add-role',  internalAuth, container.internalController.addRole);
internalRouter.get( '/internal/users/:uid',       internalAuth, container.internalController.getById);
