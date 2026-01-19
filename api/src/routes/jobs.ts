import Router from '@koa/router';
import { jobsController } from '../controllers/jobsController.js';

const router = new Router({ prefix: '/jobs' });

router.post('/upload', jobsController.upload);
router.get('/', jobsController.list);
router.get('/:id', jobsController.getById);
router.get('/:id/stream', jobsController.stream);
router.get('/:id/errors.csv', jobsController.errorsCsv);

export default router;
