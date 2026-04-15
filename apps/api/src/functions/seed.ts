import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { questionsContainer } from '../lib/cosmos';
import { sanitize } from '../lib/validation';
import type { QuestionTemplate, QuestionDoc } from '../../../../packages/shared/types';
import { v4 as uuidv4 } from 'uuid';

const SEED_TEMPLATES: QuestionTemplate[] = [
  {
    name: 'Describe CSU in one word',
    type: 'wordcloud',
    prompt: 'Describe CSU in one word!',
    settings: { maxSubmissionLength: 25, slowModeSeconds: 5 },
  },
  {
    name: 'Which topic should we go deeper on?',
    type: 'poll',
    prompt: 'Which topic should we go deeper on?',
    options: [
      'Cloud Infrastructure',
      'AI & Machine Learning',
      'Security & Compliance',
      'Developer Experience',
      'Customer Success Stories',
    ],
    settings: { multiSelect: false, hideResultsWhileLive: false },
  },
  {
    name: 'Energizer Quiz – Q1',
    type: 'quiz',
    prompt: 'What year was Microsoft founded?',
    options: ['1972', '1975', '1980', '1985'],
    correctOptionIndex: 1,
    settings: { countdownSeconds: 15 },
  },
  {
    name: 'Energizer Quiz – Q2',
    type: 'quiz',
    prompt: 'Which Azure region was the first to launch?',
    options: ['East US', 'West US', 'North Europe', 'Southeast Asia'],
    correctOptionIndex: 0,
    settings: { countdownSeconds: 15 },
  },
];

/** POST /api/seed/{eventCode} – load seed templates as draft questions */
app.http('seedTemplates', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'seed/{eventCode}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventCode = (req.params.eventCode || '').toUpperCase();
      if (!eventCode) return { status: 400, jsonBody: { error: 'eventCode required' } };

      const container = questionsContainer();
      const created: QuestionDoc[] = [];

      for (const tpl of SEED_TEMPLATES) {
        const doc: QuestionDoc = {
          id: uuidv4(),
          eventCode,
          type: tpl.type,
          prompt: tpl.prompt,
          options: tpl.options,
          correctOptionIndex: tpl.correctOptionIndex,
          settings: {
            countdownSeconds: tpl.settings?.countdownSeconds,
            multiSelect: tpl.settings?.multiSelect ?? false,
            hideResultsWhileLive: tpl.settings?.hideResultsWhileLive ?? false,
            maxSubmissionLength: tpl.settings?.maxSubmissionLength ?? 25,
            slowModeSeconds: tpl.settings?.slowModeSeconds ?? 5,
          },
          status: 'DRAFT',
          createdAt: new Date().toISOString(),
        };
        await container.items.create(doc);
        created.push(doc);
      }

      return { status: 201, jsonBody: { seeded: created.length, questions: created } };
    } catch (err: any) {
      context.error('seedTemplates error', err);
      return { status: 500, jsonBody: { error: 'Internal error' } };
    }
  },
});

/** GET /api/templates – return available templates */
app.http('getTemplates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'templates',
  handler: async (): Promise<HttpResponseInit> => {
    return { status: 200, jsonBody: SEED_TEMPLATES };
  },
});
