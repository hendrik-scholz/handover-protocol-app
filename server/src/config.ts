import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  VISION_API_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  VISION_API_KEY: z.string().default(''),
  VISION_MODEL: z.string().default('gpt-4o'),
  PORT: z.coerce.number().default(3001),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
