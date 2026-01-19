import { Middleware } from 'koa';

export const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const requestId = ctx.state.requestId;
  console.log(`[${requestId}] ${ctx.method} ${ctx.url} -> ${ctx.status} (${ms}ms)`);
};
