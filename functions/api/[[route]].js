import apiWorker from '../../worker/index.js';

export async function onRequest(context) {
  return await apiWorker.fetch(context.request, context.env);
}
