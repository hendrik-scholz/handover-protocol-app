import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let code = 'internal_error';
  let message = 'Internal server error';

  if (err instanceof HttpError) {
    ({ status, code, message } = err);
  } else if (err instanceof MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'invalid_upload';
    message = err.message;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'invalid_input';
    message = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  } else {
    console.error(err instanceof Error ? err.message : err);
  }
  res.status(status).json({ error: { code, message } });
};
