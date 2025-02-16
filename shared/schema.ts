import { z } from "zod";

export const redirectRequestSchema = z.object({
  url: z.string().url(),
  referer: z.string().optional(),
});

export interface RedirectResponse {
  redirectChain: Array<{ url: string; headers: Record<string, string>; statusCode: number }>;
  finalUrl: string;
  finalHeaders: Record<string, string>;
  finalStatusCode: number;
}
