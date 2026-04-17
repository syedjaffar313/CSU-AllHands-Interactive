import { TableClient, TableServiceClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';

let serviceClient: TableServiceClient | null = null;
const tableClients = new Map<string, TableClient>();

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
      serviceClient = new TableServiceClient(getStorageAccountUrl(), new DefaultAzureCredential());
    }
  }
  return serviceClient;
}

function getTableClient(tableName: string): TableClient {
  if (!tableClients.has(tableName)) {
    if (isLocalDev()) {
      tableClients.set(tableName, TableClient.fromConnectionString(getConnectionString(), tableName));
    } else {
      tableClients.set(tableName, new TableClient(getStorageAccountUrl(), tableName, new DefaultAzureCredential()));
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
