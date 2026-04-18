import { TableClient, TableServiceClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import type { TokenCredential } from '@azure/core-auth';

let serviceClient: TableServiceClient | null = null;
const tableClients = new Map<string, TableClient>();
let credential: TokenCredential | null = null;

function getCredential(): TokenCredential {
  if (!credential) {
    credential = new DefaultAzureCredential();
  }
  return credential;
}

function isLocalDev(): boolean {
  return !!process.env.STORAGE_CONNECTION_STRING;
}

function getStorageAccountUrl(): string {
  const url = process.env.STORAGE_ACCOUNT_URL;
  if (!url) throw new Error('STORAGE_ACCOUNT_URL or STORAGE_CONNECTION_STRING must be set');
  return url;
}

function getServiceClient(): TableServiceClient {
  if (!serviceClient) {
    if (isLocalDev()) {
      serviceClient = TableServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING!);
    } else {
      serviceClient = new TableServiceClient(getStorageAccountUrl(), getCredential());
    }
  }
  return serviceClient;
}

function getTableClient(tableName: string): TableClient {
  if (!tableClients.has(tableName)) {
    if (isLocalDev()) {
      tableClients.set(tableName, TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING!, tableName));
    } else {
      tableClients.set(tableName, new TableClient(getStorageAccountUrl(), tableName, getCredential()));
    }
  }
  return tableClients.get(tableName)!;
}

export function eventsTable(): TableClient { return getTableClient('events'); }
export function questionsTable(): TableClient { return getTableClient('questions'); }
export function responsesTable(): TableClient { return getTableClient('responses'); }

let tablesCreated = false;
export async function ensureTables(): Promise<void> {
  if (tablesCreated) return;
  const svc = getServiceClient();
  for (const name of ['events', 'questions', 'responses']) {
    try { await svc.createTable(name); } catch (e: any) {
      if (e.statusCode !== 409) throw e;
    }
  }
  tablesCreated = true;
}

export interface TableEntity {
  partitionKey: string;
  rowKey: string;
  [key: string]: any;
}

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
