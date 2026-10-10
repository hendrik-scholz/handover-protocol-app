# AI Diligence Statement

Handover Protocol is a web app that turns vehicle photos into a draft handover protocol. This statement describes where AI is used and what its limits are. It reflects the state of the code at the time of writing.

## AI in the product

- **What it does:** a vision-capable model, reached through an OpenAI-compatible API, looks at the uploaded photos and returns suggested damages (type, severity, location, description), the odometer reading, and the license plate.
- **Draft only:** all results are suggestions. The app tells the user to review them before signing. Readings taken from photos are flagged "Please verify" and can be edited. A plate the user typed is never overwritten.
- **Guardrails:**
  - The prompt tells the model to report only what is clearly visible and never to guess a reading.
  - Model output is validated against a schema, and invalid output is retried once and then rejected.
  - The server computes counts and missing photo slots itself instead of trusting the model.
- **Known limits:** the model can miss damage, report damage that is not there, misjudge severity, or misread digits. It cannot judge hidden damage, and the app does not locate damage within a photo. Results depend on photo quality, light, and the chosen model.
- **Data handling:** photos are resized, stripped of EXIF metadata, and sent to the configured model provider. The app stores nothing: no database and no saved photos. The API key stays on the server. What the provider retains is governed by that provider's terms, so choose it accordingly.
- **Not for:** automated decisions about liability, insurance, or billing without human review.

## AI in development

- The backend, frontend, tests, and `CLAUDE.md` were written with Claude (Claude Code), directed by the project owner.
- Automated tests cover the server and client and run against a mocked model.
- **Not yet done:**
  - No run against a real vision model, so detection quality is unmeasured.
  - No visual comparison against the mockups.
  - No independent human code or security review.

## Responsibilities

- A person must review every protocol before signing.
- The project owner should evaluate the chosen model on representative photos before relying on its output.
