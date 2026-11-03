import { z } from 'zod';

const list = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
const environmentSchema = z.object({
  PAYSTACK_SECRET_KEY: z
    .string()
    .regex(/^sk_test_[a-zA-Z0-9]+$/)
    .optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MCP_BEARER_TOKEN: z
    .string()
    .min(32)
    .refine(
      (value) => !/\s/.test(value) && !value.startsWith('replace-'),
      'Use a non-placeholder token without whitespace',
    ),
  ALLOWED_HOSTS: list.transform((hosts) =>
    hosts.length ? hosts : ['localhost', '127.0.0.1'],
  ),
  ALLOWED_ORIGINS: list.pipe(
    z.array(
      z
        .string()
        .url()
        .refine(
          (value) => new URL(value).origin === value,
          'Use an origin without a trailing slash or path',
        ),
    ),
  ),
});

export type Config = z.infer<typeof environmentSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    // Report field names only; never print credential values.
    throw new Error(
      `Invalid environment configuration: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  }
  return result.data;
}
