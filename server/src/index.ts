import OpenAI from 'openai';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
if (!config.VISION_API_KEY) console.warn('VISION_API_KEY is not set; /api/analyze will fail upstream.');

const client = new OpenAI({
  baseURL: config.VISION_API_BASE_URL,
  apiKey: config.VISION_API_KEY || 'missing',
  timeout: 60_000,
  maxRetries: 2,
});

createApp({ client, model: config.VISION_MODEL, maxUploadMb: config.MAX_UPLOAD_MB }).listen(config.PORT, () =>
  console.log(`Server listening on :${config.PORT}`),
);
