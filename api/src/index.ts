import Koa from 'koa';
import { koaBody } from 'koa-body';
import cors from '@koa/cors';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { logger } from './middleware/logger.js';
import { config } from './config.js';
import { startWorker } from './worker/worker.js';
import fs from 'fs';

const app = new Koa();

await fs.promises.mkdir(config.uploadDir, { recursive: true });

app.use(errorHandler);
app.use(requestId);
app.use(logger);
app.use(
  koaBody({
    multipart: true,
    formidable: {
      keepExtensions: true,
      uploadDir: config.uploadDir,
      multiples: false
    }
  })
);
app.use(
  cors({
    origin: config.corsOrigin === '*' ? '*' : config.corsOrigin,
    credentials: true
  })
);

app.use(router.routes()).use(router.allowedMethods());

app.on('error', (err, ctx) => {
  console.error('Unhandled error', err, { requestId: ctx.state.requestId });
});

startWorker();

app.listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}`);
});
