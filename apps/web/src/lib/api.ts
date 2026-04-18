const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:7071/api' : '/api')
  : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': getDeviceId(),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('ec_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ec_device_id', id);
  }
  return id;
}

export const api = {
  // Events
  getEvent: (eventCode: string) => request<any>(`/events/${eventCode}`),
  createEvent: (data: { eventCode: string; title: string }) =>
    request<any>('/events', { method: 'POST', body: JSON.stringify(data) }),
  deleteEvent: (eventCode: string) =>
    request<any>(`/events/${eventCode}`, { method: 'DELETE' }),

  // Questions
  listQuestions: (eventCode: string) => request<any[]>(`/questions?eventCode=${eventCode}`),
  createQuestion: (data: any) =>
    request<any>('/questions', { method: 'POST', body: JSON.stringify(data) }),
  launchQuestion: (questionId: string, eventCode: string) =>
    request<any>(`/questions/${questionId}/launch`, {
      method: 'POST',
      body: JSON.stringify({ eventCode }),
    }),
  closeQuestion: (questionId: string, eventCode: string) =>
    request<any>(`/questions/${questionId}/close`, {
      method: 'POST',
      body: JSON.stringify({ eventCode }),
    }),
  revealAnswer: (questionId: string, eventCode: string) =>
    request<any>(`/questions/${questionId}/reveal`, {
      method: 'POST',
      body: JSON.stringify({ eventCode }),
    }),

  // Responses
  submitResponse: (data: {
    eventCode: string;
    questionId: string;
    answer: string | number | number[];
    nickname?: string;
    deviceId: string;
  }) => request<any>('/responses', { method: 'POST', body: JSON.stringify(data) }),

  // Results (polling fallback)
  getResults: (eventCode: string, questionId: string, reveal?: boolean) =>
    request<any>(`/results/${eventCode}/${questionId}${reveal ? '?reveal=true' : ''}`),

  // Seed
  seedTemplates: (eventCode: string) =>
    request<any>(`/seed/${eventCode}`, { method: 'POST' }),

  // Templates
  getTemplates: () => request<any[]>('/seed/templates'),
};
