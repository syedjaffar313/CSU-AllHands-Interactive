import { responsesTable, queryEntities } from './storage';
import type { QuestionDoc, ResponseDoc, WordCloudTally, PollTally, QuizState } from '../../../../packages/shared/types';

const R_JSON_FIELDS = ['answer'];

/** Build word cloud tally from responses */
export async function buildWordCloudTally(eventCode: string, questionId: string): Promise<WordCloudTally> {
  const rKey = `${eventCode}_${questionId}`;
  const rTable = responsesTable();
  const responses = await queryEntities<ResponseDoc>(rTable, `PartitionKey eq '${rKey}'`, R_JSON_FIELDS);

  const counts = new Map<string, number>();
  for (const r of responses) {
    if (typeof r.answer === 'string') {
      const word = r.answer.trim().toLowerCase();
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return {
    words: Array.from(counts.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count),
    totalSubmissions: responses.length,
  };
}

/** Build poll tally from responses */
export async function buildPollTally(eventCode: string, questionId: string, question: QuestionDoc): Promise<PollTally> {
  const rKey = `${eventCode}_${questionId}`;
  const rTable = responsesTable();
  const responses = await queryEntities<ResponseDoc>(rTable, `PartitionKey eq '${rKey}'`, R_JSON_FIELDS);

  const counts = new Map<number, number>();
  let totalVotes = 0;
  for (const r of responses) {
    const indices = Array.isArray(r.answer) ? r.answer as number[] : [r.answer as number];
    for (const idx of indices) {
      counts.set(idx, (counts.get(idx) || 0) + 1);
      totalVotes++;
    }
  }

  const options = (question.options || []).map((label, i) => {
    const count = counts.get(i) || 0;
    return { label, count, percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0 };
  });

  return { options, totalVotes };
}

/** Build quiz state from responses */
export async function buildQuizState(
  eventCode: string,
  question: QuestionDoc,
  revealed: boolean,
): Promise<QuizState> {
  const rKey = `${eventCode}_${question.id}`;
  const rTable = responsesTable();
  const responses = await queryEntities<ResponseDoc>(rTable, `PartitionKey eq '${rKey}'`, R_JSON_FIELDS);

  const counts = new Map<number, number>();
  let correctCount = 0;
  for (const r of responses) {
    const indices = Array.isArray(r.answer) ? r.answer as number[] : [r.answer as number];
    for (const idx of indices) {
      counts.set(idx, (counts.get(idx) || 0) + 1);
    }
    if (question.correctOptionIndex !== undefined) {
      const picked = Array.isArray(r.answer) ? r.answer as number[] : [r.answer as number];
      if (picked.includes(question.correctOptionIndex)) correctCount++;
    }
  }

  return {
    questionId: question.id,
    status: question.status,
    prompt: question.prompt,
    options: question.options || [],
    countdownSeconds: question.settings?.countdownSeconds,
    correctOptionIndex: revealed ? question.correctOptionIndex : undefined,
    stats: {
      totalAnswered: responses.length,
      percentCorrect: responses.length > 0 ? Math.round((correctCount / responses.length) * 100) : 0,
    },
  };
}
