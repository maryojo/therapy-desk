import type { ErrorRequestHandler } from 'express';

export class ToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export function toolFailure(error: unknown) {
  const known = error instanceof ToolError;
  const payload = {
    code: known ? error.code : 'INTERNAL_ERROR',
    message: known ? error.message : 'The operation could not be completed.',
    retryable: known ? error.retryable : false,
  };
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}

export const httpErrorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (res.headersSent) {
    res.end();
    return;
  }
  const type =
    typeof error === 'object' && error !== null && 'type' in error
      ? error.type
      : undefined;
  const status =
    type === 'entity.parse.failed'
      ? 400
      : type === 'entity.too.large'
        ? 413
        : 500;
  const message =
    status === 400
      ? 'Invalid JSON body.'
      : status === 413
        ? 'Request body is too large.'
        : 'Internal server error.';
  res.status(status).json({
    error: {
      code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
      message,
    },
  });
};
