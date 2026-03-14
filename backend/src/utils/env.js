const { z } = require('zod');

/**
 * Validates required environment variables at startup.
 * Throws if any required var is missing.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('magazzino'),
  DB_USER: z.string().default('magazzino_user'),
  DB_PASSWORD: z.string().default('magazzino_pass'),

  // JWT
  JWT_SECRET: z.string().min(8).default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

/**
 * Validates environment and returns typed config
 * @returns {z.infer<typeof envSchema>}
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

module.exports = { validateEnv, envSchema };
