// ─── Event Companion – Shared Type Definitions ───

export type QuestionType = 'wordcloud' | 'poll' | 'quiz';
export type QuestionStatus = 'DRAFT' | 'LIVE' | 'CLOSED' | 'ARCHIVED';

export interface EventDoc {
  id: string;                 // eventCode (partition key)
  eventCode: string;
  title: string;
  createdAt: string;          // ISO 8601
  expiresAt: string;          // ISO 8601 – auto-expire
  activeQuestionId: string | null;
  settings: EventSettings;
}

export interface EventSettings {
  allowAnonymous: boolean;    // if false, Entra required for audience
  retentionDays: number;      // auto-delete after N days
}

export interface QuestionDoc {
  id: string;                 // unique question ID
  eventCode: string;          // partition key
  type: QuestionType;
  prompt: string;
  options?: string[];         // poll/quiz choices
  correctOptionIndex?: number; // quiz only
  settings: QuestionSettings;
  status: QuestionStatus;
  createdAt: string;
  closedAt?: string;
}

export interface QuestionSettings {
  countdownSeconds?: number;  // quiz default 15
  multiSelect?: boolean;      // poll: allow multi-choice
  hideResultsWhileLive?: boolean;
  maxSubmissionLength?: number; // wordcloud: default 25
  slowModeSeconds?: number;   // wordcloud: default 5
}

export interface ResponseDoc {
  id: string;                 // auto-generated
  eventCode: string;          // partition key
  questionId: string;
  deviceId: string;
  nickname?: string;          // optional, no PII
  answer: string | number | number[]; // text (wordcloud), index (quiz), index[] (poll multi)
  submittedAt: string;
  responseTimeMs?: number;    // quiz: time to answer
}

// ─── Tally / Broadcast Payloads ───

export interface WordCloudTally {
  words: Array<{ text: string; count: number }>;
  totalSubmissions: number;
}

export interface PollTally {
  options: Array<{ label: string; count: number; percent: number }>;
  totalVotes: number;
}

export interface QuizState {
  questionId: string;
  status: QuestionStatus;
  prompt: string;
  options: string[];
  countdownSeconds?: number;
  startedAt?: string;
  correctOptionIndex?: number; // only after reveal
  stats?: {
    totalAnswered: number;
    percentCorrect: number;
  };
  leaderboard?: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  rank: number;
}

// ─── Active Question Broadcast ───

export interface ActiveQuestionPayload {
  eventCode: string;
  question: QuestionDoc | null;  // null = no active question
}

export interface ResultsUpdatedPayload {
  eventCode: string;
  questionId: string;
  type: QuestionType;
  wordcloud?: WordCloudTally;
  poll?: PollTally;
  quiz?: QuizState;
}

// ─── API Request/Response Shapes ───

export interface SubmitResponseRequest {
  eventCode: string;
  questionId: string;
  deviceId: string;
  nickname?: string;
  answer: string | number | number[];
}

export interface CreateQuestionRequest {
  eventCode: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  settings?: Partial<QuestionSettings>;
}

export interface CreateEventRequest {
  eventCode: string;
  title: string;
  settings?: Partial<EventSettings>;
}

// ─── SignalR Messages ───

export type SignalREvent =
  | { type: 'active_question_changed'; payload: ActiveQuestionPayload }
  | { type: 'results_updated'; payload: ResultsUpdatedPayload }
  | { type: 'quiz_state_changed'; payload: QuizState };

// ─── Seed Templates ───

export interface QuestionTemplate {
  name: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  settings?: Partial<QuestionSettings>;
}
