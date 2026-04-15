import * as signalR from '@microsoft/signalr';
import { api } from './api';

type MessageHandler = (type: string, payload: any) => void;

let connection: signalR.HubConnection | null = null;
let fallbackInterval: ReturnType<typeof setInterval> | null = null;
let currentEventCode: string | null = null;
let currentQuestionId: string | null = null;
let messageHandler: MessageHandler | null = null;
let isConnected = false;

const POLL_INTERVAL_MS = 2000; // 2s fallback polling

/** Initialize SignalR connection with automatic fallback to polling. */
export async function connectSignalR(
  eventCode: string,
  onMessage: MessageHandler
): Promise<void> {
  currentEventCode = eventCode;
  messageHandler = onMessage;

  try {
    const negotiateUrl =
      typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? 'http://localhost:7071/api/negotiate'
        : '/api/negotiate';

    connection = new signalR.HubConnectionBuilder()
      .withUrl(negotiateUrl, {
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0, 1s, 2s, 4s, 8s, max 30s
          const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
          return delay;
        },
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Handle SignalR events
    connection.on('active_question_changed', (payload) => {
      if (payload.eventCode === currentEventCode) {
        currentQuestionId = payload.question?.id || null;
        messageHandler?.('active_question_changed', payload);
      }
    });

    connection.on('results_updated', (payload) => {
      if (payload.eventCode === currentEventCode) {
        messageHandler?.('results_updated', payload);
      }
    });

    connection.on('quiz_state_changed', (payload) => {
      messageHandler?.('quiz_state_changed', payload);
    });

    // Connection lifecycle
    connection.onreconnecting(() => {
      console.warn('[SignalR] Reconnecting... starting fallback polling');
      isConnected = false;
      startFallbackPolling();
    });

    connection.onreconnected(() => {
      console.info('[SignalR] Reconnected');
      isConnected = true;
      stopFallbackPolling();
    });

    connection.onclose(() => {
      console.warn('[SignalR] Connection closed; starting fallback polling');
      isConnected = false;
      startFallbackPolling();
    });

    await connection.start();
    isConnected = true;
    console.info('[SignalR] Connected');
    stopFallbackPolling();
  } catch (err) {
    console.warn('[SignalR] Failed to connect; falling back to polling', err);
    isConnected = false;
    startFallbackPolling();
  }
}

/** Disconnect SignalR + stop polling. */
export async function disconnectSignalR(): Promise<void> {
  stopFallbackPolling();
  if (connection) {
    try {
      await connection.stop();
    } catch { /* ignore */ }
    connection = null;
  }
  isConnected = false;
  currentEventCode = null;
  currentQuestionId = null;
  messageHandler = null;
}

/** Get connection status. */
export function getConnectionStatus(): 'connected' | 'reconnecting' | 'polling' {
  if (isConnected) return 'connected';
  if (connection?.state === signalR.HubConnectionState.Reconnecting) return 'reconnecting';
  return 'polling';
}

/** Start fallback polling when SignalR is unavailable. */
function startFallbackPolling(): void {
  if (fallbackInterval) return; // Already polling

  fallbackInterval = setInterval(async () => {
    if (!currentEventCode || !messageHandler) return;

    try {
      // Poll for active question
      const event = await api.getEvent(currentEventCode);
      const activeQId = event.activeQuestionId;

      if (activeQId !== currentQuestionId) {
        currentQuestionId = activeQId;
        if (activeQId) {
          // Fetch question details (we get it from the questions list)
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

      // Poll for results if there's an active question
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

/** Stop fallback polling. */
function stopFallbackPolling(): void {
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
}
