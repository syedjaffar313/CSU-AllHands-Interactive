import { CosmosClient, Container, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

let client: CosmosClient | null = null;
let database: Database | null = null;

const DB_NAME = process.env.COSMOS_DATABASE || 'eventcompanion';

function getClient(): CosmosClient {
  if (!client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint) throw new Error('COSMOS_ENDPOINT not set');
    if (key) {
      // Key-based auth for local dev (if local auth is enabled)
      client = new CosmosClient({ endpoint, key });
    } else {
      // Entra ID (Managed Identity) for production
      client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    }
  }
  return client;
}

function getDatabase(): Database {
  if (!database) {
    database = getClient().database(DB_NAME);
  }
  return database;
}

export function eventsContainer(): Container {
  return getDatabase().container('events');
}

export function questionsContainer(): Container {
  return getDatabase().container('questions');
}

export function responsesContainer(): Container {
  return getDatabase().container('responses');
}

/** Initialize database and containers (idempotent). */
export async function ensureDatabase(): Promise<void> {
  const c = getClient();
  await c.databases.createIfNotExists({ id: DB_NAME });
  const db = c.database(DB_NAME);

  await db.containers.createIfNotExists({
    id: 'events',
    partitionKey: { paths: ['/eventCode'] },
    defaultTtl: -1,
  });

  await db.containers.createIfNotExists({
    id: 'questions',
    partitionKey: { paths: ['/eventCode'] },
    defaultTtl: -1,
  });

  await db.containers.createIfNotExists({
    id: 'responses',
    partitionKey: { paths: ['/eventCode'] },
    defaultTtl: -1,
  });
}
