import { Middleware } from 'koa';

export const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const status = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : 500;
    const message = err instanceof Error ? err.message : 'Unknown error';
    ctx.status = status || 500;
    ctx.body = { error: message, requestId: ctx.state.requestId };
    ctx.app.emit('error', err, ctx);
  }
};
