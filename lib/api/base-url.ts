/**
 * THE ONE PLACE THE BACKEND URL IS DECIDED.
 *
 * It used to be decided in about forty places. Every `lib/api/*.ts` module and a
 * dozen components each declared their own `const API_URL = process.env... || <fallback>`,
 * with three different fallback conventions between them — some `localhost:8080`,
 * some the Railway production URL, some a chain of both. Nothing enforced
 * agreement, so the effective backend depended on which file a given request
 * happened to route through.
 *
 * THE FALLBACK IS THE PART THAT MATTERED. A build with no environment variables
 * set silently sent live traffic to Railway, and there was no way to tell from
 * the running site which backend it had picked — `NEXT_PUBLIC_*` values are
 * substituted into the JavaScript at build time, so the answer is frozen into a
 * bundle rather than readable from a config. That is how the first CloudFront
 * deploy went out pointing at Railway while looking, from the outside, exactly
 * like a build pointing at AWS.
 *
 * WHY THE DEFAULT IS AN EMPTY STRING IN PRODUCTION. Empty means "same origin", so
 * `fetch('/api/bins')` goes to whatever host is serving the page. CloudFront
 * routes `/api/*` to API Gateway, so a production build needs NO configuration at
 * all to reach the right backend — and switching backends is a CloudFront change
 * rather than a rebuild. Removing the ability to get this wrong beats remembering
 * to get it right.
 *
 * Development still falls back to `localhost:8080`, because there is no proxy in
 * front of `next dev` and a relative URL would just hit the Next server. That
 * fallback is safe in a way the Railway one never was: it fails loudly and
 * locally instead of quietly shipping traffic to production.
 */
export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '');

/**
 * Where this build points, for a human. Handy in a console when you are staring
 * at a deployed page wondering which backend it is talking to — which was
 * previously unanswerable without grepping the compiled chunks.
 */
export const apiBaseLabel = (): string => API_BASE || '(same origin)';
