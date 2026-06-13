const DEFAULT_ALLOWED_ORIGINS = 'http://127.0.0.1:3001,http://localhost:3001';
const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');

const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

export function isAllowedCorsOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  return (
    configuredAllowedOrigins.includes(normalizedOrigin) ||
    LOCAL_DEV_ORIGIN_PATTERN.test(normalizedOrigin)
  );
}

export function corsOriginValidator(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) {
  if (isAllowedCorsOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked: origin ${origin} not permitted`));
}

export const websocketCorsOptions = {
  origin: corsOriginValidator,
  credentials: true,
};
