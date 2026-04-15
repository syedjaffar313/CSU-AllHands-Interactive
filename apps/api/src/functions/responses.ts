import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { responsesContainer, questionsContainer } from '../lib/cosmos';
import { v4 as uuidv4 } from 'uuid';
import {
  sanitize,
  normalizeWordCloudText,
  isProfane,
  isRateLimited,
  getDeviceId,
} from '../lib/validation';
import { broadcastResults } from '../lib/signalr';
import { buildWordCloudTally, buildPollTally, buildQuizState } from '../lib/tally';
import type {
  SubmitResponseRequest,
  ResponseDoc,
  QuestionDoc,
} from '../../../../packages/shared/types';

/** POST /api/responses – submit an audience response */
app.http('submitResponse', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'responses',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await req.json()) as SubmitResponseRequest;
      if (!body.eventCode || !body.questionId || body.answer === undefined) {
        return { status: 400, jsonBody: { error: 'eventCode, questionId, answer required' } };
      }

      const eventCode = body.eventCode.toUpperCase();
      const deviceId = getDeviceId(req, body.deviceId);

      // Load question to validate
      const qContainer = questionsContainer();
      let question: QuestionDoc | undefined;
      try {
        const { resource } = await qContainer.item(body.questionId, eventCode).read<QuestionDoc>();
        question = resource ?? undefined;
      } catch {
        return { status: 404, jsonBody: { error: 'Question not found' } };
      }

      if (!question || question.status !== 'LIVE') {
        return { status: 400, jsonBody: { error: 'Question is not live' } };
      }

      // Rate limit for word cloud (slow mode)
      if (question.type === 'wordcloud') {
        const windowMs = (question.settings?.slowModeSeconds || 5) * 1000;
        if (isRateLimited(deviceId, windowMs)) {
          return { status: 429, jsonBody: { error: 'Too fast. Wait a few seconds.' } };
        }
      }

      // For quiz/poll: check duplicate per device
      if (question.type === 'quiz' || question.type === 'poll') {
        const rContainer = responsesContainer();
        const { resources: existing } = await rContainer.items
          .query({
            query:
              'SELECT c.id FROM c WHERE c.eventCode = @ec AND c.questionId = @qid AND c.deviceId = @did',
            parameters: [
              { name: '@ec', value: eventCode },
              { name: '@qid', value: body.questionId },
              { name: '@did', value: deviceId },
            ],
          })
          .fetchAll();

        if (existing.length > 0) {
          return { status: 409, jsonBody: { error: 'Already answered' } };
        }
      }

      // Validate + normalize answer
      let answer: string | number | number[] = body.answer;
      if (question.type === 'wordcloud') {
        const text = normalizeWordCloudText(String(answer));
        if (!text) return { status: 400, jsonBody: { error: 'Invalid word' } };
        if (isProfane(text)) return { status: 400, jsonBody: { error: 'Content filtered' } };
        answer = text;
      } else if (question.type === 'quiz') {
        const idx = Number(answer);
        if (isNaN(idx) || idx < 0 || idx >= (question.options?.length || 0)) {
          return { status: 400, jsonBody: { error: 'Invalid option index' } };
        }
        answer = idx;
      } else if (question.type === 'poll') {
        if (question.settings?.multiSelect && Array.isArray(answer)) {
          for (const idx of answer) {
            if (typeof idx !== 'number' || idx < 0 || idx >= (question.options?.length || 0)) {
              return { status: 400, jsonBody: { error: 'Invalid option index' } };
            }
          }
        } else {
          const idx = Number(answer);
          if (isNaN(idx) || idx < 0 || idx >= (question.options?.length || 0)) {
            return { status: 400, jsonBody: { error: 'Invalid option index' } };
          }
          answer = idx;
        }
      }

      // Calculate response time for quiz
      let responseTimeMs: number | undefined;
      if (question.type === 'quiz') {
        const startTime = new Date(question.createdAt).getTime();
        responseTimeMs = Date.now() - startTime;
      }

      const doc: ResponseDoc = {
        id: uuidv4(),
        eventCode,
        questionId: body.questionId,
        deviceId,
        nickname: body.nickname ? sanitize(body.nickname).slice(0, 30) : undefined,
        answer,
        submittedAt: new Date().toISOString(),
        responseTimeMs,
      };

      const rContainer = responsesContainer();
      await rContainer.items.create(doc);

      // Build and broadcast updated results
      if (question.type === 'wordcloud') {
        const tally = await buildWordCloudTally(eventCode, question.id);
        await broadcastResults(eventCode, question.id, 'wordcloud', tally);
      } else if (question.type === 'poll') {
        if (!question.settings?.hideResultsWhileLive) {
          const tally = await buildPollTally(eventCode, question);
          await broadcastResults(eventCode, question.id, 'poll', undefined, tally);
        }
      } else if (question.type === 'quiz') {
        const state = await buildQuizState(eventCode, question, false);
        await broadcastResults(eventCode, question.id, 'quiz', undefined, undefined, state);
      }

      return { status: 201, jsonBody: { submitted: true, id: doc.id } };
    } catch (err: any) {
      context.error('submitResponse error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** GET /api/results/{eventCode}/{questionId} – get current results (polling fallback) */
app.http('getResults', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'results/{eventCode}/{questionId}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();
      const questionId = req.params.questionId || '';

      const qContainer = questionsContainer();
      const { resource: question } = await qContainer.item(questionId, eventCode).read<QuestionDoc>();
      if (!question) return { status: 404, jsonBody: { error: 'Question not found' } };

      if (question.type === 'wordcloud') {
        const tally = await buildWordCloudTally(eventCode, questionId);
        return { status: 200, jsonBody: { type: 'wordcloud', wordcloud: tally } };
      } else if (question.type === 'poll') {
        const tally = await buildPollTally(eventCode, question);
        return { status: 200, jsonBody: { type: 'poll', poll: tally } };
      } else {
        const reveal = req.query.get('reveal') === 'true';
        const state = await buildQuizState(eventCode, question, reveal);
        return { status: 200, jsonBody: { type: 'quiz', quiz: state } };
      }
    } catch (err: any) {
      context.error('getResults error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** GET /api/export/{eventCode}/{questionId} – export responses as JSON */
app.http('exportResults', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'export/{eventCode}/{questionId}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();
      const questionId = req.params.questionId || '';
      const format = req.query.get('format') || 'json';

      const container = responsesContainer();
      const { resources } = await container.items
        .query<ResponseDoc>({
          query: 'SELECT * FROM c WHERE c.eventCode = @ec AND c.questionId = @qid',
          parameters: [
            { name: '@ec', value: eventCode },
            { name: '@qid', value: questionId },
          ],
        })
        .fetchAll();

      if (format === 'csv') {
        const headers = 'id,eventCode,questionId,deviceId,nickname,answer,submittedAt,responseTimeMs';
        const rows = resources.map((r) =>
          [r.id, r.eventCode, r.questionId, r.deviceId, r.nickname || '', String(r.answer), r.submittedAt, r.responseTimeMs || ''].join(',')
        );
        return {
          status: 200,
          body: [headers, ...rows].join('\n'),
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${eventCode}_${questionId}.csv"`,
          },
        };
      }

      return { status: 200, jsonBody: resources };
    } catch (err: any) {
      context.error('exportResults error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});
