import { PostHog } from "posthog-node";

type PostHogEnv = Env & { POSTHOG_HOST?: string };

const resolvePostHogHost = (env: PostHogEnv) =>
  env.POSTHOG_API_HOST ?? env.POSTHOG_HOST;

export const createPostHogClient = (env: Env) => {
  const posthogEnv = env as PostHogEnv;
  const apiKey = posthogEnv.POSTHOG_API_KEY ?? "";
  if (!apiKey) return null;
  const host = resolvePostHogHost(posthogEnv);
  return new PostHog(apiKey, {
    host,
    flushAt: 1, // Send events immediately in edge environment
    flushInterval: 0, // Don't wait for interval
  });
};
