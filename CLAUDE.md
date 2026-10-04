# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository.

## Project overview

A mobile-first web app for creating a **vehicle handover protocol from photos**. The user captures guided photos of a vehicle (front, left, rear, right, interior, dashboard/odometer). The backend sends them to a vision-capable LLM, which returns detected damages. The user reviews the draft protocol and adds remarks and signatures.

**MVP scope:** show that uploading photos leads to a protocol. The backend is **stateless**: no database, no file storage, no PDF export, no server-side signing. The client holds all state.

Status: backend (`server/`) and frontend (`client/`) MVPs implemented. Mockups are in `mockups/`. The client has not yet been checked visually against the mockups or run against a real model.

## Tech stack

- **Frontend:** React (Vite, TypeScript), mobile-first. Lives in `client/`.
- **Backend:** Node.js (Express, TypeScript). Lives in `server/`.
- **AI:** Any **OpenAI-compatible REST API** with a vision-capable model, called **only from the backend**. Use the official `openai` npm package with a configurable `baseURL`, so the provider (OpenAI, Azure, vLLM, Ollama, OpenRouter, ...) can be swapped through configuration alone.

## Intended repository layout

```
client/            React app (Vite, no router; one useReducer in App)
  src/state.ts     Types, reducer, selectors (single source of client state)
  src/copy.ts      All UI strings
  src/pages/       CapturePage (step 1), ProtocolPage (step 2)
  src/components/  Viewfinder, SlotChips, PhotoGrid, DamageCard, SignaturePad, ...
  src/hooks/       useCamera (getUserMedia + torch), useObjectUrl
  src/api/         analyze.ts (FormData POST, error-code mapping)
  src/styles/      tokens.css (all colors live here), base.css, components.css
server/
  src/routes/      analyze.ts (POST /api/analyze)
  src/services/    vision.ts (LLM call, prompt, parse/retry), images.ts (sharp)
  src/schemas.ts   Zod schemas and shared types
  src/middleware/  errorHandler.ts (HttpError, JSON error shape)
  test/            vitest + supertest with a fake LLM client
mockups/           Reference designs (PDF), the source of truth for UI
```

If types are shared between client and server, put them in a small `shared/` package rather than duplicating them.

## Commands

Server (run in `server/`; copy `.env.example` to `.env` first):

```bash
npm install
npm run dev              # tsx watch on src/index.ts
npm test                 # vitest, mocked LLM
npm run typecheck
npm run build && npm start
```

Manual check: `curl -F front=@front.jpg -F left=@left.jpg localhost:3001/api/analyze`

Client (run in `client/`; start the server first, Vite proxies `/api` to `localhost:3001`):

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # vitest + testing-library
npm run build            # typecheck + production build
```

## Configuration

The backend reads configuration from environment variables (`server/.env`, never committed; keep `server/.env.example` up to date):

| Variable | Purpose |
|---|---|
| `VISION_API_BASE_URL` | Base URL of the OpenAI-compatible API, e.g. `https://api.openai.com/v1` |
| `VISION_API_KEY` | API key. Backend only; must never reach the client bundle |
| `VISION_MODEL` | Model name with image input support |
| `PORT` | Backend port |
| `MAX_UPLOAD_MB` | Upload size limit per photo |

## Domain model

- **Vehicle:** plate number, mileage (km), handover date (the API still accepts an optional `makeModel`, but the client does not send it).
- **Photo slot:** `front`, `left`, `rear`, `right`, `interior`, `dashboard` (odometer). A slot is captured or missing. Missing slots must be reported in the protocol ("Not covered yet: ...").
- **Damage:** type (scratch, dent, scuff marks, crack, ...), severity (`minor` | `moderate` | `severe`), location (part plus position, e.g. "Front bumper, lower left"), reference to the source photo slot, short description, optional estimated size.
- **Protocol draft** (returned by the API): vehicle, captured/missing slots, damages (ids assigned by the server), severity summary. Remarks and signatures exist only on the client in the MVP.

## API

- `GET /api/health`
- `POST /api/analyze`: multipart/form-data. File fields: `front`, `left`, `rear`, `right`, `interior`, `dashboard` (at least one). Optional text fields: `plate`, `makeModel`, `mileageKm`. Returns the protocol draft JSON. Errors use `{error:{code,message}}`: 400 invalid input, 413 too large, 422 unusable model output, 502/504 upstream failure.

## UI flow (see `mockups/`)

1. **Capture photos** (`1_Capture_photos.pdf`): vehicle header with photo count, camera viewfinder with a dashed outline for the current slot and a positioning hint, slot chips (checked when captured), gallery upload button, shutter, flash toggle, and an "Analyze N photos" CTA. Analysis is allowed with a partial set of photos.
2. **Protocol result** (`2_Protocol_result.pdf`; the mockup is light, but the app uses the dark-blue theme of step 1 on both screens, with colors re-mapped in `tokens.css`): vehicle summary, damage summary banner (counts by severity plus unchecked slots), photo grid with numbered damage markers, "Add <slot>" tiles for missing slots, damage cards, a coverage notice, remarks, two signature pads, "Confirm and sign" and "Export as PDF". Footer disclaimer: damages are suggestions and must be reviewed before signing. In the MVP there is no PDF export (button omitted); signature pads are client-only canvases and "Confirm and sign" just locks the screen locally. The plate is an editable field and there is no make/model field. The API returns no damage coordinates, so photo badges sit at a fixed spot per tile.

Use the camera through `<input type="file" accept="image/*" capture="environment">` or `getUserMedia`. Fall back to gallery upload.

## Vision LLM integration

- Keep all model calls in `server/src/services/vision.ts`.
- Send images as base64 data URLs in `image_url` content parts, one message with all photos, each labelled with its slot name.
- Downscale and re-encode images on the server (e.g. `sharp`, about 1568 px on the long side, JPEG) before sending, to control token cost and latency. Strip EXIF.
- Request structured JSON output (`response_format` with a JSON schema where the provider supports it). **Always validate the response with Zod**, since not every OpenAI-compatible provider enforces schemas. On a parse failure, retry once, then return a clear error.
- The prompt must make the model only report damages it can see, reference the photo slot, and not invent damage on slots that weren't provided.
- The same call also reads the odometer (`odometerValue` + `odometerUnit`) from the dashboard/interior photo. The server converts miles to km, ignores readings without a unit, and prefers the photo reading over a typed mileage (`vehicle.mileageSource` = `photo` | `user` | null). The client prefills the mileage field and asks the user to verify it.
- The call also returns `plateText` read from a front/rear photo. The server normalizes it; a plate typed by the user always wins (`vehicle.plateSource`), the photo only fills an empty field.
- Set timeouts and handle rate-limit/5xx errors with a retry and backoff.
- Don't log image data or API keys.

## Conventions

- TypeScript strict mode on both sides.
- Validate every request body and upload on the backend (Zod, file type and size checks via `multer`). Never persist photos.
- The LLM result is a **draft**. Damages should be editable on the client before signing (post-MVP).
- Damage numbering on photos and in the list must match.
- Keep UI text in one place so it can be localized later.
- Tests: unit-test the vision response parsing and the protocol logic with a mocked LLM client. Never call the real API in tests.
