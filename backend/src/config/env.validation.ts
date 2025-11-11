import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

/**
 * Validate required environment variables at startup
 * Fails fast if configuration is missing or invalid
 */
export function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_EXPIRATION',
    'JWT_REFRESH_EXPIRATION',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.';
    logger.error(error);
    throw new Error(error);
  }

  // Validate JWT secret strength
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length < 32) {
    const error =
      'JWT_SECRET must be at least 32 characters long for security.\n' +
      'Please generate a strong secret key.';
    logger.error(error);
    throw new Error(error);
  }

  const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
  if (refreshSecret.length < 32) {
    const error =
      'JWT_REFRESH_SECRET must be at least 32 characters long for security.\n' +
      'Please generate a strong secret key.';
    logger.error(error);
    throw new Error(error);
  }

  // Validate secrets are different
  if (jwtSecret === refreshSecret) {
    const error =
      'JWT_SECRET and JWT_REFRESH_SECRET must be different.\n' +
      'Please use different secret keys for access and refresh tokens.';
    logger.error(error);
    throw new Error(error);
  }

  // Validate JWT expiration format
  const jwtExpPattern = /^\d+[smhd]$/;
  if (!jwtExpPattern.test(process.env.JWT_EXPIRATION || '')) {
    const error =
      'JWT_EXPIRATION must be in format: <number><unit> (e.g., 15m, 1h, 7d)';
    logger.error(error);
    throw new Error(error);
  }

  if (!jwtExpPattern.test(process.env.JWT_REFRESH_EXPIRATION || '')) {
    const error =
      'JWT_REFRESH_EXPIRATION must be in format: <number><unit> (e.g., 15m, 1h, 7d)';
    logger.error(error);
    throw new Error(error);
  }

  logger.log('✅ Environment configuration validated successfully');
  logger.log(`- Node environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`- JWT expiration: ${process.env.JWT_EXPIRATION}`);
  logger.log(`- JWT refresh expiration: ${process.env.JWT_REFRESH_EXPIRATION}`);
}

/**
 * Get environment variables with defaults
 */
export function getEnvConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    databaseUrl: process.env.DATABASE_URL || '',
    jwt: {
      secret: process.env.JWT_SECRET || '',
      refreshSecret: process.env.JWT_REFRESH_SECRET || '',
      expiration: process.env.JWT_EXPIRATION || '15m',
      refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
    },
    security: {
      accountLockoutAttempts: parseInt(
        process.env.ACCOUNT_LOCKOUT_ATTEMPTS || '5',
        10,
      ),
      accountLockoutDuration: process.env.ACCOUNT_LOCKOUT_DURATION || '30m',
      passwordResetExpiration: process.env.PASSWORD_RESET_EXPIRATION || '1h',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      ttl: parseInt(process.env.REDIS_TTL || '300', 10),
    },
  };
}
