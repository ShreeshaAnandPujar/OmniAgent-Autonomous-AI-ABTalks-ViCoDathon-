import type { AuthContext } from '../middleware/auth.js';

/**
 * Hono environment type variables used across routes.
 * Defines custom context variables set by middleware.
 */
export interface AppEnv {
  Variables: {
    auth: AuthContext | null;
  };
}
