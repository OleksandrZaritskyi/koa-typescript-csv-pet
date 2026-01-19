import { Middleware } from 'koa';
import { v4 as uuid } from 'uuid';

export const requestId: Middleware = async (ctx, next) => {
  ctx.state.requestId = uuid();
  await next();
};
