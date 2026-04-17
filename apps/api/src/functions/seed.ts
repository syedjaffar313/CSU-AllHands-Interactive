import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { questionsTable, toTableEntity, queryEntities } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import type { QuestionDoc } from '../../../../packages/shared/types';

const Q_JSON_FIELDS = ['options', 'settings'];

const TEMPLATES: Omit<QuestionDoc, 'id' | 'eventCode' | 'createdAt'>[] = [
  {
    type: 'wordcloud',
    prompt: 'In one word, what excites you most about CSU?',
    status: 'DRAFT',
    settings: { maxSubmissionLength: 25, slowModeSeconds: 5, multiSelect: false, hideResultsWhileLive: false },
  },
  {
    type: 'poll',
    prompt: 'Which CSU value resonates with you the most?',
    options: ['Customer Obsession', 'One Microsoft', 'Growth Mindset', 'Diversity & Inclusion'],
    status: 'DRAFT',
    settings: { multiSelect: false, hideResultsWhileLive: false },
  },
  {
    type: 'quiz',
    prompt: 'How many countries does CSU operate in?',
    options: ['50+', '100+', '120+', '150+'],
    correctOptionIndex: 2,
    status: 'DRAFT',
    settings: { countdownSeconds: 15, multiSelect: false, hideResultsWhileLive: false },
  },
  {
    type: 'wordcloud',
    prompt: 'What is one thing you are proud of from this fiscal year?',
    status: 'DRAFT',
    settings: { maxSubmissionLength: 40, slowModeSeconds: 5, multiSelect: false, hideResultsWhileLive: false },
  },
  {
    type: 'poll',
    prompt: 'What topic would you like to hear more about?',
    options: ['AI & Innovation', 'Career Growth', 'Work-Life Balance', 'Customer Success Stories'],
    status: 'DRAFT',
    settings: { multiSelect: true, hideResultsWhileLive: false },
  },
  {
    type: 'quiz',
    prompt: 'What does CSU stand for?',
    options: [
      'Customer Service Unit',
      'Customer Success Unit',
      'Cloud Solutions Unit',
      'Customer Support & Usage',
    ],
    correctOptionIndex: 1,
    status: 'DRAFT',
    settings: { countdownSeconds: 10, multiSelect: false, hideResultsWhileLive: false },
  },
];

/** POST /api/seed/{eventCode} – seed template questions */
app.http('seedTemplates', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'seed/{eventCode}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();
      if (!eventCode) return { status: 400, jsonBody: { error: 'eventCode required' } };

      const table = questionsTable();
      const existing = await queryEntities<QuestionDoc>(table, `PartitionKey eq '${eventCode}'`, Q_JSON_FIELDS);
      if (existing.length > 0) {
        return { status: 409, jsonBody: { error: `Event ${eventCode} already has ${existing.length} questions` } };
      }

      const created: QuestionDoc[] = [];
      for (const tmpl of TEMPLATES) {
        const doc: QuestionDoc = {
          ...tmpl,
          id: uuidv4(),
          eventCode,
          createdAt: new Date().toISOString(),
        };
        await table.createEntity(toTableEntity(doc, eventCode, doc.id));
        created.push(doc);
      }

      return { status: 201, jsonBody: { seeded: created.length, questions: created } };
    } catch (err: any) {
      context.error('seedTemplates error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** GET /api/seed/templates – preview available templates */
app.http('getTemplates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'seed/templates',
  handler: async (): Promise<HttpResponseInit> => {
    return { status: 200, jsonBody: TEMPLATES };
  },
});
