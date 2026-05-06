/**
 * Shared types for this Worker.
 * All types used across more than one file go here.
 */

/**
 * Worker environment bindings.
 */
export type Env = {
  BUCKET: R2Bucket;
  JWT_SECRET: string;
  STEERING_MODE: string;
  ROLLOUT_PCT: string;
};
