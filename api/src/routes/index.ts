import Router from '@koa/router';
import jobsRouter from './jobs.js';

const router = new Router({ prefix: '/api' });

router.use(jobsRouter.routes()).use(jobsRouter.allowedMethods());

export default router;
