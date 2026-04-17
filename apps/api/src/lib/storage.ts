import { TableClient, TableServiceClient } from '@azure/data-tables';
import type { TokenCredential, AccessToken, GetTokenOptions } from '@azure/core-auth';

let serviceClient: TableServiceClient | null = null;
const tableClients = new Map<string, TableClient>();
let credential: TokenCredential | null = null;

/**
 * Custom TokenCredential that calls the SWA/App Service MSI endpoint directly.
 * Works around @azure/identity ManagedIdentityCredential bugs in SWA managed functions.
 */
class SwaIdentityCredential implements TokenCredential {
  async getToken(scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> {
    const resource = (Array.isArray(scopes) ? scopes[0] : scopes).replace(/\/.default$/, '');
    const endpoint = process.env.IDENTITY_ENDPOINT;
    const header = process.env.IDENTITY_HEADER;
    if (!endpoint || !header) {
      throw new Error('IDENTITY_ENDPOINT or IDENTITY_HEADER not set – managed identity unavailable');
    }
    const url = `${endpoint}?resource=${encodeURIComponent(resource)}&api-version=2019-08-01`;
    const resp = await fetch(url, { headers: { 'X-IDENTITY-HEADER': header } });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`MSI token request failed (${resp.status}): ${body}`);
    }
    const json = await resp.json() as { access_token: string; expires_on: string };
    // expires_on can be a Unix timestamp string or an ISO date
    const expiresOn = /^\d+$/.test(json.expires_on)
      ? parseInt(json.expires_on, 10) * 1000
      : new Date(json.expires_on).getTime();
    return { token: json.access_token, expiresOnTimestamp: expiresOn };
  }
}

function getCredential(): TokenCredential {
  if (!credential) {
    credential = new SwaIdentityCredential();
  }
  return credential;
}

function isLocalDev(): boolean {
  return !!process.env.STORAGE_CONNECTION_STRING;
}

function getConnectionString(): string {
  return process.env.STORAGE_CONNECTION_STRING!;
}

function getStorageAccountUrl(): string {
  const url = process.env.STORAGE_ACCOUNT_URL;
  if (!url) throw new Error('STORAGE_ACCOUNT_URL or STORAGE_CONNECTION_STRING must be set');
  return url;
}

function getServiceClient(): TableServiceClient {
  if (!serviceClient) {
    if (isLocalDev()) {
      serviceClient = TableServiceClient.fromConnectionString(getConnectionString());
    } else {
      serviceClient = new TableServiceClient(getStorageAccountUrl(), getCredential());
    }
  }
  return serviceClient;
}

function getTableClient(tableName: string): TableClient {
  if (!tableClients.has(tableName)) {
    if (isLocalDev()) {
      tableClients.set(tableName, TableClient.fromConnectionString(getConnectionString(), tableName));
    } else {
      tableClients.set(tableName, new TableClient(getStorageAccountUrl(), tableName, getCredential()));
    }
  }
  return tableClients.get(tableName)!;
}

export function eventsTable(): TableClient { return getTableClient('events'); }
export function questionsTable(): TableClient { return getTableClient('questions'); }
export function responsesTable(): TableClient { return getTableClient('responses'); }

/** Ensure tables exist (idempotent). */
let tablesCreated = false;
export async function ensureTables(): Promise<void> {
  if (tablesCreated) return;
  const svc = getServiceClient();
  for (const name of ['events', 'questions', 'responses']) {
    try { await svc.createTable(name); } catch (e: any) {
      if (e.statusCode !== 409) throw e; // 409 = already exists
    }
  }
  tablesCreated = true;
}

// ─── Helper: Table Storage uses partitionKey + rowKey ───
// events:    partitionKey = eventCode, rowKey = eventCode
// questions: partitionKey = eventCode, rowKey = questionId
// responses: partitionKey = eventCode, rowKey = responseId

export interface TableEntity {
  partitionKey: string;
  rowKey: string;
  [key: string]: any;
}

/** Serialize complex fields (objects/arrays) to JSON strings for Table Storage. */
export function toTableEntity(doc: Record<string, any>, partitionKey: string, rowKey: string): TableEntity {
  const entity: TableEntity = { partitionKey, rowKey };
  for (const [key, value] of Object.entries(doc)) {
    if (key === 'id' || key === 'partitionKey' || key === 'rowKey') continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') {
      entity[key] = JSON.stringify(value);
    } else {
      entity[key] = value;
    }
  }
  return entity;
}

/** Deserialize JSON string fields back to objects. */
export function fromTableEntity<T>(entity: Record<string, any>, jsonFields: string[]): T {
  const doc: any = { id: entity.rowKey };
  for (const [key, value] of Object.entries(entity)) {
    if (key === 'partitionKey' || key === 'rowKey' || key === 'etag' || key === 'odata.etag' || key === 'timestamp') continue;
    if (jsonFields.includes(key) && typeof value === 'string') {
      try { doc[key] = JSON.parse(value); } catch { doc[key] = value; }
    } else {
      doc[key] = value;
    }
  }
  return doc as T;
}

/** Query all entities matching a filter in a table. */
export async function queryEntities<T>(
  table: TableClient,
  filter: string,
  jsonFields: string[]
): Promise<T[]> {
  const results: T[] = [];
  const iter = table.listEntities({ queryOptions: { filter } });
  for await (const entity of iter) {
    results.push(fromTableEntity<T>(entity, jsonFields));
  }
  return results;
}
