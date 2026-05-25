import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const usersRouter = Router();

usersRouter.post('/users',                  authenticate(), authorize('g12', 'admin', 'super_admin'), container.usersController.create);
usersRouter.get( '/users',                  authenticate(), authorize('leader', 'g12', 'admin'), container.usersController.list);
usersRouter.get( '/users/:uid',             authenticate(), authorize('leader', 'g12', 'admin'), container.usersController.getOne);
usersRouter.post(  '/users/:uid/suspend',     authenticate(), authorize('admin'), container.usersController.suspend);
usersRouter.post(  '/users/:uid/reactivate',  authenticate(), authorize('admin'), container.usersController.reactivate);
usersRouter.delete('/users/:uid',             authenticate(), authorize('admin'), container.usersController.delete);
usersRouter.patch('/users/:uid/roles',      authenticate(), authorize('admin', 'g12'),           container.usersController.assignRole);
// G12 leaders can promote a member/leader to 'leader' or 'g12'
usersRouter.post('/users/:uid/promote',     authenticate(), authorize('leader', 'g12', 'admin', 'super_admin'), container.usersController.promote);
// Demote a user — remove a role and revert to remaining roles; caller-role guards inside use case
usersRouter.post('/users/:uid/demote',      authenticate(), authorize('leader', 'g12', 'admin', 'super_admin'), container.usersController.demote);
