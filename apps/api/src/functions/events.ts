import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { eventsTable, questionsTable, responsesTable, ensureTables, toTableEntity, fromTableEntity, queryEntities } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { sanitize } from '../lib/validation';
import type { EventDoc, CreateEventRequest } from '../../../../packages/shared/types';

const EVENT_JSON_FIELDS = ['settings'];

/** POST /api/events – create a new event */
app.http('createEvent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await req.json()) as CreateEventRequest;
      if (!body.eventCode || !body.title) {
        return { status: 400, jsonBody: { error: 'eventCode and title required' } };
      }

      const eventCode = sanitize(body.eventCode).toUpperCase().replace(/\s/g, '');
      if (eventCode.length < 2 || eventCode.length > 20) {
        return { status: 400, jsonBody: { error: 'eventCode must be 2-20 chars' } };
      }

      await ensureTables();
      const table = eventsTable();

      // Check if exists
      try {
        const existing = await table.getEntity(eventCode, eventCode);
        if (existing) {
          return { status: 409, jsonBody: { error: 'Event already exists' } };
        }
      } catch (e: any) {
        if (e.statusCode !== 404) throw e;
      }

      const retentionDays = body.settings?.retentionDays || 30;
      const doc: EventDoc = {
        id: eventCode,
        eventCode,
        title: sanitize(body.title),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + retentionDays * 86400000).toISOString(),
        activeQuestionId: null,
        settings: {
          allowAnonymous: body.settings?.allowAnonymous ?? true,
          retentionDays,
        },
      };

      const entity = toTableEntity(doc, eventCode, eventCode);
      await table.createEntity(entity);
      return { status: 201, jsonBody: doc };
    } catch (err: any) {
      context.error('createEvent error', err);
      return { status: 500, jsonBody: { error: 'Internal error', debug: err.message } };
    }
  },
});

/** GET /api/events/{eventCode} – get event details */
app.http('getEvent', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventCode}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();
      const table = eventsTable();

      try {
        const entity = await table.getEntity(eventCode, eventCode);
        const doc = fromTableEntity<EventDoc>(entity, EVENT_JSON_FIELDS);
        return { status: 200, jsonBody: doc };
      } catch (e: any) {
        if (e.statusCode === 404) return { status: 404, jsonBody: { error: 'Event not found' } };
        throw e;
      }
    } catch (err: any) {
      context.error('getEvent error', err);
      return { status: 500, jsonBody: { error: 'Internal error', debug: err.message, stack: err.stack?.split('\n').slice(0, 3) } };
    }
  },
});

/** DELETE /api/events/{eventCode} – delete event + all related data */
app.http('deleteEvent', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'events/{eventCode}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();

      // Delete all questions
      const qTable = questionsTable();
      const questions = await queryEntities<{ id: string }>(qTable, `PartitionKey eq '${eventCode}'`, []);
      for (const q of questions) {
        try { await qTable.deleteEntity(eventCode, q.id); } catch { /* ignore */ }
      }

      // Delete all responses
      const rTable = responsesTable();
      const responses = await queryEntities<{ id: string }>(rTable, `PartitionKey eq '${eventCode}'`, []);
      for (const r of responses) {
        try { await rTable.deleteEntity(eventCode, r.id); } catch { /* ignore */ }
      }

      // Delete event
      const table = eventsTable();
      try { await table.deleteEntity(eventCode, eventCode); } catch { /* ignore */ }

      return { status: 200, jsonBody: { deleted: true } };
    } catch (err: any) {
      context.error('deleteEvent error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});
