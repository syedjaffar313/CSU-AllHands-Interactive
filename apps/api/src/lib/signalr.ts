import type {
  QuestionDoc,
  QuestionType,
  WordCloudTally,
  PollTally,
  QuizState,
} from '../../../../packages/shared/types';

/**
 * SignalR broadcast helpers.
 * Uses Azure SignalR REST API (serverless mode) to send messages to the hub.
 */

function getSignalRConfig() {
  const connectionString = process.env.SIGNALR_CONNECTION_STRING || '';
  const endpointMatch = connectionString.match(/Endpoint=([^;]+)/);
  const keyMatch = connectionString.match(/AccessKey=([^;]+)/);
  if (!endpointMatch || !keyMatch) return null;
  return {
    endpoint: endpointMatch[1].replace(/\/$/, ''),
    accessKey: keyMatch[1],
  };
}

async function generateToken(url: string, accessKey: string): Promise<string> {
  const crypto = await import('crypto');
  const expiry = Math.floor(Date.now() / 1000) + 60;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ aud: url, exp: expiry, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const signature = crypto.createHmac('sha256', accessKey).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function sendToHub(target: string, args: any[]): Promise<void> {
  const config = getSignalRConfig();
  if (!config) {
    console.warn('SignalR not configured; skipping broadcast');
    return;
  }

  const hubName = 'eventHub';
  const url = `${config.endpoint}/api/v1/hubs/${hubName}`;
  const token = await generateToken(url, config.accessKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ target, arguments: args }),
  });

  if (!response.ok) {
    console.error(`SignalR broadcast failed: ${response.status} ${await response.text()}`);
  }
}

/** Broadcast active question changed. */
export async function broadcastActiveQuestion(
  eventCode: string,
  question: QuestionDoc | null
): Promise<void> {
  await sendToHub('active_question_changed', [{ eventCode, question }]);
}

/** Broadcast results updated. */
export async function broadcastResults(
  eventCode: string,
  questionId: string,
  type: QuestionType,
  wordcloud?: WordCloudTally,
  poll?: PollTally,
  quiz?: QuizState
): Promise<void> {
  await sendToHub('results_updated', [
    { eventCode, questionId, type, wordcloud, poll, quiz },
  ]);
}
