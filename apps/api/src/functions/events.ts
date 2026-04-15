import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { eventsContainer, questionsContainer, responsesContainer, ensureDatabase } from '../lib/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { sanitize } from '../lib/validation';
import type { EventDoc, CreateEventRequest } from '../../../../packages/shared/types';

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

      await ensureDatabase();
      const container = eventsContainer();

      // Check if exists
      try {
        const { resource } = await container.item(eventCode, eventCode).read<EventDoc>();
        if (resource) {
          return { status: 409, jsonBody: { error: 'Event already exists' } };
        }
      } catch {
        // Not found – proceed
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
        // Set TTL in seconds
        ...(retentionDays > 0 ? { ttl: retentionDays * 86400 } : {}),
      };

      await container.items.create(doc);
      return { status: 201, jsonBody: doc };
    } catch (err: any) {
      context.error('createEvent error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
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
      const container = eventsContainer();
      const { resource } = await container.item(eventCode, eventCode).read<EventDoc>();

      if (!resource) {
        return { status: 404, jsonBody: { error: 'Event not found' } };
      }

      return { status: 200, jsonBody: resource };
    } catch (err: any) {
      if (err.code === 404) return { status: 404, jsonBody: { error: 'Event not found' } };
      context.error('getEvent error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
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
      const qContainer = questionsContainer();
      const { resources: questions } = await qContainer.items
        .query({ query: 'SELECT c.id FROM c WHERE c.eventCode = @ec', parameters: [{ name: '@ec', value: eventCode }] })
        .fetchAll();
      for (const q of questions) {
        await qContainer.item(q.id, eventCode).delete();
      }

      // Delete all responses
      const rContainer = responsesContainer();
      const { resources: responses } = await rContainer.items
        .query({ query: 'SELECT c.id FROM c WHERE c.eventCode = @ec', parameters: [{ name: '@ec', value: eventCode }] })
        .fetchAll();
      for (const r of responses) {
        await rContainer.item(r.id, eventCode).delete();
      }

      // Delete event
      const container = eventsContainer();
      await container.item(eventCode, eventCode).delete();

      return { status: 200, jsonBody: { deleted: true } };
    } catch (err: any) {
      context.error('deleteEvent error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});
