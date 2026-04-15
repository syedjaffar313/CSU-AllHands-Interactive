import {
  WordCloudTally,
  PollTally,
  QuizState,
  ResponseDoc,
  QuestionDoc,
  LeaderboardEntry,
} from '../../../../packages/shared/types';
import { responsesContainer } from './cosmos';

/** Build word cloud tally from responses. Returns top 30 words. */
export async function buildWordCloudTally(
  eventCode: string,
  questionId: string
): Promise<WordCloudTally> {
  const container = responsesContainer();
  const { resources } = await container.items
    .query<ResponseDoc>({
      query:
        'SELECT c.answer FROM c WHERE c.eventCode = @ec AND c.questionId = @qid',
      parameters: [
        { name: '@ec', value: eventCode },
        { name: '@qid', value: questionId },
      ],
    })
    .fetchAll();

  const freq = new Map<string, number>();
  for (const r of resources) {
    const word = String(r.answer).toLowerCase().trim();
    if (word) freq.set(word, (freq.get(word) || 0) + 1);
  }

  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([text, count]) => ({ text, count }));

  return { words: sorted, totalSubmissions: resources.length };
}

/** Build poll tally. */
export async function buildPollTally(
  eventCode: string,
  question: QuestionDoc
): Promise<PollTally> {
  const container = responsesContainer();
  const { resources } = await container.items
    .query<ResponseDoc>({
      query:
        'SELECT c.answer FROM c WHERE c.eventCode = @ec AND c.questionId = @qid',
      parameters: [
        { name: '@ec', value: eventCode },
        { name: '@qid', value: question.id },
      ],
    })
    .fetchAll();

  const counts = new Map<number, number>();
  for (const r of resources) {
    const indices = Array.isArray(r.answer) ? r.answer : [r.answer];
    for (const idx of indices) {
      const i = Number(idx);
      if (!isNaN(i)) counts.set(i, (counts.get(i) || 0) + 1);
    }
  }

  const totalVotes = resources.length;
  const options = (question.options || []).map((label, i) => {
    const count = counts.get(i) || 0;
    return {
      label,
      count,
      percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
    };
  });

  return { options, totalVotes };
}

/** Build quiz state with leaderboard. */
export async function buildQuizState(
  eventCode: string,
  question: QuestionDoc,
  reveal: boolean
): Promise<QuizState> {
  const container = responsesContainer();
  const { resources } = await container.items
    .query<ResponseDoc>({
      query:
        'SELECT c.answer, c.nickname, c.responseTimeMs, c.deviceId FROM c WHERE c.eventCode = @ec AND c.questionId = @qid',
      parameters: [
        { name: '@ec', value: eventCode },
        { name: '@qid', value: question.id },
      ],
    })
    .fetchAll();

  const correctIdx = question.correctOptionIndex;
  let correctCount = 0;
  const scores = new Map<string, { nickname: string; score: number }>();

  for (const r of resources) {
    const isCorrect = Number(r.answer) === correctIdx;
    if (isCorrect) correctCount++;

    // Score: 100 for correct + speed bonus (0-50)
    let score = 0;
    if (isCorrect) {
      score = 100;
      const countdown = question.settings?.countdownSeconds || 15;
      const elapsed = r.responseTimeMs ? r.responseTimeMs / 1000 : countdown;
      const speedBonus = Math.max(0, Math.round(50 * (1 - elapsed / countdown)));
      score += speedBonus;
    }

    const key = r.deviceId;
    const existing = scores.get(key);
    if (!existing || score > existing.score) {
      scores.set(key, { nickname: r.nickname || `Player ${key.slice(0, 4)}`, score });
    }
  }

  const leaderboard: LeaderboardEntry[] = [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  const state: QuizState = {
    questionId: question.id,
    status: question.status,
    prompt: question.prompt,
    options: question.options || [],
    countdownSeconds: question.settings?.countdownSeconds,
    startedAt: question.status === 'LIVE' ? question.createdAt : undefined,
    stats: {
      totalAnswered: resources.length,
      percentCorrect:
        resources.length > 0 ? Math.round((correctCount / resources.length) * 100) : 0,
    },
  };

  if (reveal) {
    state.correctOptionIndex = correctIdx;
    state.leaderboard = leaderboard;
  }

  return state;
}
