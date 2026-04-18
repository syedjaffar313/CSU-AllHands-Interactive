import { api } from './api';

type MessageHandler = (type: string, payload: any) => void;

let fallbackInterval: ReturnType<typeof setInterval> | null = null;
let currentEventCode: string | null = null;
let currentQuestionId: string | null = null;
let messageHandler: MessageHandler | null = null;

const POLL_INTERVAL_MS = 2000;

export async function connectSignalR(
  eventCode: string,
  onMessage: MessageHandler
): Promise<void> {
  currentEventCode = eventCode;
  messageHandler = onMessage;
  startFallbackPolling();
}

export async function disconnectSignalR(): Promise<void> {
  stopFallbackPolling();
  currentEventCode = null;
  currentQuestionId = null;
  messageHandler = null;
}

export function getConnectionStatus(): 'connected' | 'reconnecting' | 'polling' {
  return 'polling';
}

function startFallbackPolling(): void {
  if (fallbackInterval) return;

  fallbackInterval = setInterval(async () => {
    if (!currentEventCode || !messageHandler) return;

    try {
      const event = await api.getEvent(currentEventCode);
      const activeQId = event.activeQuestionId;

      if (activeQId !== currentQuestionId) {
        currentQuestionId = activeQId;
        if (activeQId) {
          const questions = await api.listQuestions(currentEventCode);
          const activeQ = questions.find((q: any) => q.id === activeQId);
          messageHandler('active_question_changed', {
            eventCode: currentEventCode,
            question: activeQ || null,
          });
        } else {
          messageHandler('active_question_changed', {
            eventCode: currentEventCode,
            question: null,
          });
        }
      }

      if (activeQId) {
        const results = await api.getResults(currentEventCode, activeQId);
        messageHandler('results_updated', {
          eventCode: currentEventCode,
          questionId: activeQId,
          ...results,
        });
      }
    } catch (err) {
      console.warn('[Polling] Error fetching updates', err);
    }
  }, POLL_INTERVAL_MS);
}

function stopFallbackPolling(): void {
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
}
