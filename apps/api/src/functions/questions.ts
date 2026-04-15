import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { questionsContainer, eventsContainer } from '../lib/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { sanitize } from '../lib/validation';
import { broadcastActiveQuestion, broadcastResults } from '../lib/signalr';
import { buildWordCloudTally, buildPollTally, buildQuizState } from '../lib/tally';
import type {
  QuestionDoc,
  CreateQuestionRequest,
  EventDoc,
  QuestionStatus,
} from '../../../../packages/shared/types';

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

      const container = questionsContainer();
      await container.items.create(doc);

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
      const container = questionsContainer();
      const { resources } = await container.items
        .query<QuestionDoc>({
          query: 'SELECT * FROM c WHERE c.eventCode = @ec ORDER BY c.createdAt DESC',
          parameters: [{ name: '@ec', value: eventCode }],
        })
        .fetchAll();

      return { status: 200, jsonBody: resources };
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

      const qContainer = questionsContainer();
      const { resource: question } = await qContainer.item(questionId, eventCode).read<QuestionDoc>();
      if (!question) return { status: 404, jsonBody: { error: 'Question not found' } };

      // Close any currently active question
      const eContainer = eventsContainer();
      const { resource: event } = await eContainer.item(eventCode, eventCode).read<EventDoc>();
      if (event?.activeQuestionId && event.activeQuestionId !== questionId) {
        try {
          const { resource: prev } = await qContainer.item(event.activeQuestionId, eventCode).read<QuestionDoc>();
          if (prev && prev.status === 'LIVE') {
            prev.status = 'CLOSED';
            prev.closedAt = new Date().toISOString();
            await qContainer.item(prev.id, eventCode).replace(prev);
          }
        } catch { /* previous question may have been deleted */ }
      }

      // Launch this question
      question.status = 'LIVE';
      question.createdAt = new Date().toISOString(); // reset start time for quiz countdown
      await qContainer.item(questionId, eventCode).replace(question);

      // Update event
      if (event) {
        event.activeQuestionId = questionId;
        await eContainer.item(eventCode, eventCode).replace(event);
      }

      // Broadcast
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

      const qContainer = questionsContainer();
      const { resource: question } = await qContainer.item(questionId, eventCode).read<QuestionDoc>();
      if (!question) return { status: 404, jsonBody: { error: 'Question not found' } };

      question.status = 'CLOSED';
      question.closedAt = new Date().toISOString();
      await qContainer.item(questionId, eventCode).replace(question);

      // Clear active question on event
      const eContainer = eventsContainer();
      const { resource: event } = await eContainer.item(eventCode, eventCode).read<EventDoc>();
      if (event && event.activeQuestionId === questionId) {
        event.activeQuestionId = null;
        await eContainer.item(eventCode, eventCode).replace(event);
      }

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

      const qContainer = questionsContainer();
      const { resource: question } = await qContainer.item(questionId, eventCode).read<QuestionDoc>();
      if (!question) return { status: 404, jsonBody: { error: 'Question not found' } };
      if (question.type !== 'quiz') return { status: 400, jsonBody: { error: 'Not a quiz' } };

      const quizState = await buildQuizState(eventCode, question, true);

      // Broadcast revealed results
      await broadcastResults(eventCode, questionId, 'quiz', undefined, undefined, quizState);

      return { status: 200, jsonBody: quizState };
    } catch (err: any) {
      context.error('revealAnswer error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});
