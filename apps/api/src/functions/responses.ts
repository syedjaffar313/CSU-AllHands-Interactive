import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { responsesTable, questionsTable, queryEntities, toTableEntity, fromTableEntity } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { sanitize } from '../lib/validation';
import { broadcastResults } from '../lib/signalr';
import { buildWordCloudTally, buildPollTally, buildQuizState } from '../lib/tally';
import type { ResponseDoc, QuestionDoc } from '../../../../packages/shared/types';

const Q_JSON_FIELDS = ['options', 'settings'];
const R_JSON_FIELDS = ['answer'];

/** POST /api/responses – submit a response */
app.http('submitResponse', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'responses',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await req.json()) as {
        eventCode: string;
        questionId: string;
        deviceId: string;
        nickname?: string;
        answer?: string | number | number[];
        responseTimeMs?: number;
      };

      if (!body.eventCode || !body.questionId || !body.deviceId) {
        return { status: 400, jsonBody: { error: 'eventCode, questionId, deviceId required' } };
      }

      const eventCode = body.eventCode.toUpperCase();
      const questionId = body.questionId;

      // Verify question exists and is LIVE
      const qTable = questionsTable();
      let question: QuestionDoc;
      try {
        const entity = await qTable.getEntity(eventCode, questionId);
        question = fromTableEntity<QuestionDoc>(entity, Q_JSON_FIELDS);
      } catch (e: any) {
        if (e.statusCode === 404) return { status: 404, jsonBody: { error: 'Question not found' } };
        throw e;
      }

      if (question.status !== 'LIVE') {
        return { status: 400, jsonBody: { error: 'Question is not live' } };
      }

      // Word cloud: require string answer
      if (question.type === 'wordcloud') {
        if (!body.answer || typeof body.answer !== 'string') {
          return { status: 400, jsonBody: { error: 'answer (string) required for wordcloud' } };
        }
        const maxLen = question.settings?.maxSubmissionLength ?? 25;
        if (body.answer.length > maxLen) {
          return { status: 400, jsonBody: { error: `Answer exceeds max length of ${maxLen}` } };
        }
      }

      // Poll/quiz: require numeric answer
      if ((question.type === 'poll' || question.type === 'quiz') && body.answer === undefined) {
        return { status: 400, jsonBody: { error: 'answer required for poll/quiz' } };
      }

      // Check duplicates (one response per device per question)
      const rTable = responsesTable();
      const rKey = `${eventCode}_${questionId}`;
      const existing = await queryEntities<ResponseDoc>(
        rTable,
        `PartitionKey eq '${rKey}' and deviceId eq '${body.deviceId}'`,
        R_JSON_FIELDS,
      );
      if (existing.length > 0) {
        return { status: 409, jsonBody: { error: 'Already responded' } };
      }

      const answerValue = question.type === 'wordcloud' ? sanitize(body.answer as string) : body.answer!;

      const doc: ResponseDoc = {
        id: uuidv4(),
        eventCode,
        questionId,
        deviceId: body.deviceId,
        nickname: body.nickname,
        answer: answerValue,
        submittedAt: new Date().toISOString(),
        responseTimeMs: body.responseTimeMs,
      };

      const entity = toTableEntity(doc, rKey, doc.id);
      await rTable.createEntity(entity);

      // Broadcast updated tallies
      if (question.type === 'wordcloud') {
        const tally = await buildWordCloudTally(eventCode, questionId);
        await broadcastResults(eventCode, questionId, 'wordcloud', tally);
      } else if (question.type === 'poll') {
        const tally = await buildPollTally(eventCode, questionId, question);
        await broadcastResults(eventCode, questionId, 'poll', undefined, tally);
      } else if (question.type === 'quiz') {
        const state = await buildQuizState(eventCode, question, false);
        await broadcastResults(eventCode, questionId, 'quiz', undefined, undefined, state);
      }

      return { status: 201, jsonBody: doc };
    } catch (err: any) {
      context.error('submitResponse error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** GET /api/responses/{eventCode}/{questionId} – get tallied results */
app.http('getResults', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'responses/{eventCode}/{questionId}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();
      const questionId = req.params.questionId || '';

      const qTable = questionsTable();
      let question: QuestionDoc;
      try {
        const entity = await qTable.getEntity(eventCode, questionId);
        question = fromTableEntity<QuestionDoc>(entity, Q_JSON_FIELDS);
      } catch (e: any) {
        if (e.statusCode === 404) return { status: 404, jsonBody: { error: 'Question not found' } };
        throw e;
      }

      let result: any = { question };

      if (question.type === 'wordcloud') {
        result.wordCloudEntries = await buildWordCloudTally(eventCode, questionId);
      } else if (question.type === 'poll') {
        result.pollResults = await buildPollTally(eventCode, questionId, question);
      } else if (question.type === 'quiz') {
        result.quizState = await buildQuizState(eventCode, question, false);
      }

      return { status: 200, jsonBody: result };
    } catch (err: any) {
      context.error('getResults error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** GET /api/responses/{eventCode}/{questionId}/export */
app.http('exportResults', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'responses/{eventCode}/{questionId}/export',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();
      const questionId = req.params.questionId || '';
      const rKey = `${eventCode}_${questionId}`;
      const rTable = responsesTable();
      const responses = await queryEntities<ResponseDoc>(rTable, `PartitionKey eq '${rKey}'`, R_JSON_FIELDS);

      const qTable = questionsTable();
      let question: QuestionDoc;
      try {
        const entity = await qTable.getEntity(eventCode, questionId);
        question = fromTableEntity<QuestionDoc>(entity, Q_JSON_FIELDS);
      } catch (e: any) {
        if (e.statusCode === 404) return { status: 404, jsonBody: { error: 'Question not found' } };
        throw e;
      }

      // Build CSV
      let csv = 'deviceId,submittedAt,answer\n';

      for (const r of responses) {
        const answerStr = Array.isArray(r.answer) ? (r.answer as number[]).join(';') : String(r.answer || '');
        csv += `${r.deviceId},${r.submittedAt},"${answerStr.replace(/"/g, '""')}"\n`;
      }

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${eventCode}_${questionId}.csv"`,
        },
        body: csv,
      };
    } catch (err: any) {
      context.error('exportResults error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});
