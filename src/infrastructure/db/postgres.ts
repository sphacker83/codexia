import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";

const DEFAULT_DATABASE_POOL_MAX = 10;

let databasePool: Pool | null = null;

function toPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function shouldUseDatabaseSsl(): boolean {
  const raw = process.env.DATABASE_SSL?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "require";
}

function getRequiredDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for SignalForge PostgreSQL access.");
  }
  return databaseUrl;
}

function createDatabasePool(): Pool {
  return new Pool({
    connectionString: getRequiredDatabaseUrl(),
    max: toPositiveInteger(process.env.DATABASE_POOL_MAX, DEFAULT_DATABASE_POOL_MAX),
    ssl: shouldUseDatabaseSsl() ? { rejectUnauthorized: false } : undefined,
  });
}

export function isSignalsDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getSignalsDatabasePool(): Pool {
  if (!databasePool) {
    databasePool = createDatabasePool();
  }
  return databasePool;
}

export async function querySignalsDb<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  return getSignalsDatabasePool().query<Row>(text, values as unknown[]);
}

export async function withSignalsDbClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getSignalsDatabasePool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closeSignalsDbPool(): Promise<void> {
  if (!databasePool) {
    return;
  }
  await databasePool.end();
  databasePool = null;
}
