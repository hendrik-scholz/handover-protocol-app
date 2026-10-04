import type OpenAI from 'openai';
import { HttpError } from '../middleware/errorHandler.js';
import { VisionResultSchema, type Slot, type VisionResult } from '../schemas.js';

export interface SlotImage {
  slot: Slot;
  jpeg: Buffer;
}

export type VisionClient = Pick<OpenAI, 'chat'>;

const SYSTEM_PROMPT = `You inspect photos of a vehicle for a handover protocol.
Report only damage that is clearly visible in the provided photos (scratches, dents, scuff marks, cracks, broken parts, rust, etc.).
Rules:
- Each damage must reference the photo slot it is visible in.
- Do not speculate about areas or slots that were not provided.
- Do not report dirt, reflections, or normal wear as damage.
- severity: "minor" = cosmetic, paint/surface only; "moderate" = deformation or paint broken; "severe" = structural, glass, or safety-relevant.
- "location" is the part plus position, e.g. "Front bumper, lower left".
- "description" is one or two factual sentences. Do not invent measurements.

Odometer: if the dashboard or interior photo shows the instrument cluster, read the TOTAL odometer (accumulated distance), not the trip meter, and not the fuel gauge, clock or range.
- odometerValue: the integer shown, digits only (ignore decimals and separators). null if no odometer is visible or you cannot read every digit with confidence. Never guess.
- odometerUnit: "km" or "mi" as shown on the display or its label; null if odometerValue is null or the unit is not visible.
License plate: if the front or rear photo shows the license plate of the photographed vehicle, return it in plateText exactly as printed (letters, digits, and any separators such as hyphens or spaces; ignore stickers, seals and state/country marks). null if no plate is visible, it is not on the photographed vehicle, or any character is unclear. Never guess.
Respond with JSON only: {"damages":[{"type","severity","location","slot","description"}],"odometerValue":number|null,"odometerUnit":"km"|"mi"|null,"plateText":string|null}. Use "damages":[] if there is none.`;

const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'damage_report',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['damages', 'odometerValue', 'odometerUnit', 'plateText'],
      properties: {
        damages: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'severity', 'location', 'slot', 'description'],
            properties: {
              type: { type: 'string' },
              severity: { type: 'string', enum: ['minor', 'moderate', 'severe'] },
              location: { type: 'string' },
              slot: { type: 'string', enum: ['front', 'left', 'rear', 'right', 'interior', 'dashboard'] },
              description: { type: 'string' },
            },
          },
        },
        odometerValue: { type: ['integer', 'null'] },
        odometerUnit: { type: ['string', 'null'], enum: ['km', 'mi', null] },
        plateText: { type: ['string', 'null'] },
      },
    },
  },
} as const;

function buildUserContent(images: SlotImage[]) {
  const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: `Photos provided: ${images.map((i) => i.slot).join(', ')}.` },
  ];
  for (const { slot, jpeg } of images) {
    parts.push({ type: 'text', text: `Slot: ${slot}` });
    parts.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${jpeg.toString('base64')}` },
    });
  }
  return parts;
}

function parseResult(raw: string | null | undefined, provided: Slot[]): VisionResult {
  if (!raw) throw new Error('empty response');
  // Some providers wrap JSON in code fences.
  const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const result = VisionResultSchema.parse(JSON.parse(text));
  const unknown = result.damages.find((d) => !provided.includes(d.slot));
  if (unknown) throw new Error(`damage references slot "${unknown.slot}" that was not provided`);
  return result;
}

export async function detectDamages(
  client: VisionClient,
  model: string,
  images: SlotImage[],
): Promise<VisionResult> {
  const provided = images.map((i) => i.slot);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserContent(images) },
  ];

  let lastError = 'unknown';
  for (let attempt = 0; attempt < 2; attempt++) {
    let content: string | null | undefined;
    try {
      const res = await client.chat.completions.create({
        model,
        messages,
        temperature: 0,
        response_format: RESPONSE_FORMAT,
      });
      content = res.choices[0]?.message?.content;
    } catch (err) {
      throw upstreamError(err);
    }
    try {
      return parseResult(content, provided);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      messages.push(
        { role: 'assistant', content: content ?? '' },
        {
          role: 'user',
          content: `Your response was invalid (${lastError}). Respond again with valid JSON only, matching the schema.`,
        },
      );
    }
  }
  throw new HttpError(422, 'unusable_model_output', `Model returned invalid output: ${lastError}`);
}

function upstreamError(err: unknown): HttpError {
  const status = (err as { status?: number }).status;
  const name = (err as { name?: string }).name;
  if (name === 'APIConnectionTimeoutError') return new HttpError(504, 'upstream_timeout', 'Vision model timed out');
  if (status === 401 || status === 403) return new HttpError(502, 'upstream_auth', 'Vision API rejected the credentials');
  return new HttpError(502, 'upstream_error', 'Vision model request failed');
}
