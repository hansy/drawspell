import type { AuthConfig } from "@mtg/auth";
export interface DeveloperEnv {
  AUTH_TEST_SECRET?: string;
  DB: AuthConfig["db"];
  BETTER_AUTH_SECRET: string;
  AUTH_URL: string;
  EMAIL_FROM: string;
  EMAIL: {
    send(message: {
      from: { email: string; name: string };
      to: string;
      subject: string;
      text: string;
      html: string;
    }): Promise<unknown>;
  };
  SERVER: { fetch(request: Request): Promise<Response> };
  ROOM_PROVISION_SECRET: string;
}
