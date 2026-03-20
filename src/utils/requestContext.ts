import { AsyncLocalStorage } from 'async_hooks';
import { ResponseFormat } from '../config';

interface RequestContext {
  responseFormat?: ResponseFormat;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestFormat(): ResponseFormat | undefined {
  return requestContext.getStore()?.responseFormat;
}
