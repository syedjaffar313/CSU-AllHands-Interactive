import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { questionsTable, eventsTable, toTableEntity, fromTableEntity, queryEntities } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { sanitize } from '../lib/validation';
import { broadcastActiveQuestion, broadcastResults } from '../lib/signalr';
import { buildWordCloudTally, buildPollTally, buildQuizState } from '../lib/tally';
import type {
  QuestionDoc,
  CreateQuestionRequest,
  EventDoc,
} from '../../../../packages/shared/types';

const Q_JSON_FIELDS = ['options', 'settings'];
const E_JSON_FIELDS = ['settings'];

/** POST /api/questions – create a draft question */
app.http('createQuestion', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await req.json()) as CreateQuestionRequest;
      if (!body.eventCode || !body.type || !body.prompt) {
        return { status: 400, jsonBody: { error: 'eventCode, type, prompt required' } };
      }

      const validTypes = ['wordcloud', 'poll', 'quiz'];
      if (!validTypes.includes(body.type)) {
        return { status: 400, jsonBody: { error: 'type must be wordcloud, poll, or quiz' } };
      }

      if ((body.type === 'poll' || body.type === 'quiz') && (!body.options || body.options.length < 2)) {
        return { status: 400, jsonBody: { error: 'poll/quiz require at least 2 options' } };
      }

      if (body.type === 'quiz' && (body.correctOptionIndex === undefined || body.correctOptionIndex === null)) {
        return { status: 400, jsonBody: { error: 'quiz requires correctOptionIndex' } };
      }

      const doc: QuestionDoc = {
        id: uuidv4(),
        eventCode: body.eventCode.toUpperCase(),
        type: body.type,
        prompt: sanitize(body.prompt),
        options: body.options?.map((o) => sanitize(o)),
        correctOptionIndex: body.correctOptionIndex,
        settings: {
          countdownSeconds: body.settings?.countdownSeconds ?? (body.type === 'quiz' ? 15 : undefined),
          multiSelect: body.settings?.multiSelect ?? false,
          hideResultsWhileLive: body.settings?.hideResultsWhileLive ?? false,
          maxSubmissionLength: body.settings?.maxSubmissionLength ?? 25,
          slowModeSeconds: body.settings?.slowModeSeconds ?? 5,
        },
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      };

      const table = questionsTable();
      const entity = toTableEntity(doc, doc.eventCode, doc.id);
      await table.createEntity(entity);

      return { status: 201, jsonBody: doc };
    } catch (err: any) {
      context.error('createQuestion error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** GET /api/questions/{eventCode} – list all questions for an event */
app.http('listQuestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'questions/{eventCode}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();
      const table = questionsTable();
      const results = await queryEntities<QuestionDoc>(table, `PartitionKey eq '${eventCode}'`, Q_JSON_FIELDS);
      results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return { status: 200, jsonBody: results };
    } catch (err: any) {
      context.error('listQuestions error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** POST /api/questions/{questionId}/launch – set question LIVE + update event activeQuestionId */
app.http('launchQuestion', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions/{questionId}/launch',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const questionId = req.params.questionId || '';
      const body = (await req.json()) as { eventCode: string };
      const eventCode = (body.eventCode || '').toUpperCase();

      const qTable = questionsTable();
      let question: QuestionDoc;
      try {
        const entity = await qTable.getEntity(eventCode, questionId);
        question = fromTableEntity<QuestionDoc>(entity, Q_JSON_FIELDS);
      } catch (e: any) {
        if (e.statusCode === 404) return { status: 404, jsonBody: { error: 'Question not found' } };
        throw e;
      }

      // Close any currently active question
      const eTable = eventsTable();
      let event: EventDoc | null = null;
      try {
        const eEntity = await eTable.getEntity(eventCode, eventCode);
        event = fromTableEntity<EventDoc>(eEntity, E_JSON_FIELDS);
      } catch { /* event may not exist */ }

      if (event?.activeQuestionId && event.activeQuestionId !== questionId) {
        try {
          const prevEntity = await qTable.getEntity(eventCode, event.activeQuestionId);
          const prev = fromTableEntity<QuestionDoc>(prevEntity, Q_JSON_FIELDS);
          if (prev && prev.status === 'LIVE') {
            prev.status = 'CLOSED';
            prev.closedAt = new Date().toISOString();
            await qTable.updateEntity(toTableEntity(prev, eventCode, prev.id), 'Replace');
          }
        } catch { /* previous question may have been deleted */ }
      }

      // Launch this question
      question.status = 'LIVE';
      question.createdAt = new Date().toISOString();
      await qTable.updateEntity(toTableEntity(question, eventCode, question.id), 'Replace');

      // Update event
      if (event) {
        event.activeQuestionId = questionId;
        await eTable.updateEntity(toTableEntity(event, eventCode, eventCode), 'Replace');
      }

      await broadcastActiveQuestion(eventCode, question);
      return { status: 200, jsonBody: question };
    } catch (err: any) {
      context.error('launchQuestion error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** POST /api/questions/{questionId}/close */
app.http('closeQuestion', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions/{questionId}/close',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const questionId = req.params.questionId || '';
      const body = (await req.json()) as { eventCode: string };
      const eventCode = (body.eventCode || '').toUpperCase();

      const qTable = questionsTable();
      let question: QuestionDoc;
      try {
        const entity = await qTable.getEntity(eventCode, questionId);
        question = fromTableEntity<QuestionDoc>(entity, Q_JSON_FIELDS);
      } catch (e: any) {
        if (e.statusCode === 404) return { status: 404, jsonBody: { error: 'Question not found' } };
        throw e;
      }

      question.status = 'CLOSED';
      question.closedAt = new Date().toISOString();
      await qTable.updateEntity(toTableEntity(question, eventCode, question.id), 'Replace');

      // Clear active question on event
      const eTable = eventsTable();
      try {
        const eEntity = await eTable.getEntity(eventCode, eventCode);
        const event = fromTableEntity<EventDoc>(eEntity, E_JSON_FIELDS);
        if (event && event.activeQuestionId === questionId) {
          event.activeQuestionId = null;
          await eTable.updateEntity(toTableEntity(event, eventCode, eventCode), 'Replace');
        }
      } catch { /* event may not exist */ }

      await broadcastActiveQuestion(eventCode, null);
      return { status: 200, jsonBody: question };
    } catch (err: any) {
      context.error('closeQuestion error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** POST /api/questions/{questionId}/reveal – reveal quiz answer */
app.http('revealAnswer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions/{questionId}/reveal',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const questionId = req.params.questionId || '';
      const body = (await req.json()) as { eventCode: string };
      const eventCode = (body.eventCode || '').toUpperCase();

      const qTable = questionsTable();
      let question: QuestionDoc;
      try {
        const entity = await qTable.getEntity(eventCode, questionId);
        question = fromTableEntity<QuestionDoc>(entity, Q_JSON_FIELDS);
      } catch (e: any) {
        if (e.statusCode === 404) return { status: 404, jsonBody: { error: 'Question not found' } };
        throw e;
      }

      if (question.type !== 'quiz') return { status: 400, jsonBody: { error: 'Not a quiz' } };

      const quizState = await buildQuizState(eventCode, question, true);
      await broadcastResults(eventCode, questionId, 'quiz', undefined, undefined, quizState);

      return { status: 200, jsonBody: quizState };
    } catch (err: any) {
      context.error('revealAnswer error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});
