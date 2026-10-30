import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function bearerAuth(token: string): RequestHandler {
  const expected = digest(token);
  return (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match?.[1] || !timingSafeEqual(digest(match[1]), expected)) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="therapydesk"');
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'A valid bearer token is required.',
        },
      });
      return;
    }
    next();
  };
}
