import { createPrivateKey } from 'node:crypto';
import { postgresPoolConfig } from '@lessonquest/db/postgres';
export function readServerConfiguration(environment: Record<string, string | undefined>) {
  try {
    if (
      environment.FIREBASE_AUTH_EMULATOR_HOST !== undefined ||
      environment.FIREBASE_DATABASE_EMULATOR_HOST !== undefined
    )
      throw new Error();
    const projectId = environment.LESSONQUEST_FIREBASE_PROJECT_ID;
    const origin = environment.LESSONQUEST_TRUSTED_ORIGIN;
    const databaseUrl = environment.LESSONQUEST_DATABASE_URL;
    const credential = environment.LESSONQUEST_FIREBASE_SERVICE_ACCOUNT_JSON;
    if (
      projectId !== 'lessonquest-df4b0' ||
      !origin ||
      !databaseUrl ||
      !credential ||
      credential.length > 16384
    )
      throw new Error();
    const url = new URL(origin);
    if (
      url.protocol !== 'https:' ||
      url.origin !== origin ||
      !url.hostname.includes('.') ||
      url.hostname === 'localhost' ||
      url.username ||
      url.password
    )
      throw new Error();
    postgresPoolConfig({ connectionString: databaseUrl, schema: 'lessonquest' });
    const data: unknown = JSON.parse(credential);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    const account = data as Record<string, unknown>;
    if (
      account.type !== 'service_account' ||
      account.project_id !== projectId ||
      typeof account.client_email !== 'string' ||
      !/^[-a-z0-9]+@lessonquest-df4b0\.iam\.gserviceaccount\.com$/.test(account.client_email) ||
      typeof account.private_key !== 'string'
    )
      throw new Error();
    const key = createPrivateKey(account.private_key);
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
      throw new Error();
    return {
      projectId,
      origin,
      databaseUrl,
      serviceAccount: {
        projectId,
        clientEmail: account.client_email,
        privateKey: account.private_key,
      },
    };
  } catch {
    throw new Error('Server configuration is unavailable');
  }
}
