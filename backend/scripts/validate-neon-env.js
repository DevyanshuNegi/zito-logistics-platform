const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const REQUIRED_ENV_KEYS = ['DATABASE_URL', 'DIRECT_URL'];

function parseDatabaseUrl(rawValue, envKey) {
  if (!rawValue) {
    return { envKey, errors: [`${envKey} is missing`] };
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch (error) {
    return { envKey, errors: [`${envKey} is not a valid PostgreSQL URL`] };
  }

  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) {
    return {
      envKey,
      errors: [`${envKey} must start with postgresql:// or postgres://`],
    };
  }

  return { envKey, parsed, errors: [] };
}

function hasSslModeRequire(parsedUrl) {
  return parsedUrl.searchParams.get('sslmode') === 'require';
}

function isNeonHost(hostname) {
  return hostname.toLowerCase().includes('neon.tech');
}

function isPoolerHost(hostname) {
  return hostname.toLowerCase().includes('pooler');
}

function collectErrors() {
  const results = REQUIRED_ENV_KEYS.map((envKey) =>
    parseDatabaseUrl(process.env[envKey], envKey),
  );

  const errors = results.flatMap((result) => result.errors);
  const databaseUrl = results.find((result) => result.envKey === 'DATABASE_URL');
  const directUrl = results.find((result) => result.envKey === 'DIRECT_URL');

  if (databaseUrl && databaseUrl.parsed) {
    if (!isNeonHost(databaseUrl.parsed.hostname)) {
      errors.push('DATABASE_URL must point to a Neon host');
    }
    if (!isPoolerHost(databaseUrl.parsed.hostname)) {
      errors.push('DATABASE_URL must use the Neon pooler host');
    }
    if (!hasSslModeRequire(databaseUrl.parsed)) {
      errors.push('DATABASE_URL must include sslmode=require');
    }
  }

  if (directUrl && directUrl.parsed) {
    if (!isNeonHost(directUrl.parsed.hostname)) {
      errors.push('DIRECT_URL must point to a Neon host');
    }
    if (isPoolerHost(directUrl.parsed.hostname)) {
      errors.push('DIRECT_URL must use the direct Neon host, not the pooler host');
    }
    if (!hasSslModeRequire(directUrl.parsed)) {
      errors.push('DIRECT_URL must include sslmode=require');
    }
  }

  return {
    errors,
    databaseHost: databaseUrl && databaseUrl.parsed ? databaseUrl.parsed.hostname : null,
    directHost: directUrl && directUrl.parsed ? directUrl.parsed.hostname : null,
  };
}

function main() {
  const { errors, databaseHost, directHost } = collectErrors();

  if (errors.length > 0) {
    console.error('Neon environment validation failed:\n');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error('\nExpected setup:');
    console.error('- DATABASE_URL uses the Neon pooler host');
    console.error('- DIRECT_URL uses the direct Neon host');
    console.error('- Both URLs include sslmode=require');
    process.exit(1);
  }

  console.log('Neon environment validation passed.');
  console.log(`- DATABASE_URL host: ${databaseHost}`);
  console.log(`- DIRECT_URL host: ${directHost}`);
}

main();
