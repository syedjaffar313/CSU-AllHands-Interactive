'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button,
  Input,
  RadioGroup,
  Radio,
  Checkbox,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { SendFilled, CheckmarkCircleFilled } from '@fluentui/react-icons';
import { connectSignalR, disconnectSignalR, getConnectionStatus } from '@/lib/signalr';
import { api, getDeviceId } from '@/lib/api';
import type {
  QuestionDoc,
  ActiveQuestionPayload,
} from '@/types';

const useStyles = makeStyles({
  scene: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '16px',
    paddingTop: '0',
    paddingBottom: '100px',
    background: '#fafbfc',
  },
  topBar: {
    position: 'sticky' as const,
    top: '0',
    width: '100%',
    maxWidth: '520px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 0',
    zIndex: 10,
    backdropFilter: 'blur(16px)',
    background: 'rgba(250,251,252,0.85)',
  },
  statusDot: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: '600' as unknown as number,
    color: '#aaa',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  eventTag: {
    fontSize: '12px',
    fontWeight: '700' as unknown as number,
    color: '#bbb',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  card: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '28px 24px',
    maxWidth: '520px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
  },
  waiting: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '60px 24px',
    textAlign: 'center' as const,
  },
  waitIcon: {
    fontSize: '48px',
    lineHeight: '1',
    opacity: 0.4,
  },
  waitTitle: {
    fontSize: '22px',
    fontWeight: '700' as unknown as number,
    color: '#1a1a1a',
    letterSpacing: '-0.01em',
  },
  waitBody: {
    fontSize: '15px',
    color: '#999',
    lineHeight: '1.5',
    maxWidth: '280px',
  },
  submitted: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '20px',
    textAlign: 'center' as const,
    background: 'rgba(16,185,129,0.06)',
    borderRadius: '14px',
  },
  submittedIcon: {
    color: '#10b981',
    fontSize: '32px',
  },
  submittedText: {
    fontSize: '15px',
    fontWeight: '600' as unknown as number,
    color: '#10b981',
  },
  countdown: {
    fontSize: '56px',
    fontWeight: '800' as unknown as number,
    textAlign: 'center' as const,
    lineHeight: '1',
    background: 'linear-gradient(135deg, #0078d4, #50e6ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  prompt: {
    fontSize: '20px',
    fontWeight: '700' as unknown as number,
    textAlign: 'center' as const,
    color: '#1a1a1a',
    lineHeight: '1.35',
    letterSpacing: '-0.01em',
  },
  optionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1.5px solid rgba(0,0,0,0.08)',
    background: '#fafafa',
    cursor: 'pointer',
    transitionProperty: 'all',
    transitionDuration: '0.15s',
    ':hover': {
      background: 'rgba(0,120,212,0.04)',
      border: '1.5px solid rgba(0,120,212,0.15)',
    },
  },
  optionSelected: {
    border: '1.5px solid #0078d4',
    background: 'rgba(0,120,212,0.06)',
  },
  optionLabel: {
    fontSize: '15px',
    fontWeight: '500' as unknown as number,
    color: '#333',
    flex: 1,
  },
  optionIndex: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700' as unknown as number,
    background: 'rgba(0,0,0,0.04)',
    color: '#888',
    flexShrink: 0,
  },
  timedOut: {
    textAlign: 'center' as const,
    fontSize: '16px',
    fontWeight: '600' as unknown as number,
    color: '#dc2626',
    padding: '20px',
    background: 'rgba(220,38,38,0.06)',
    borderRadius: '14px',
  },
  error: {
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#dc2626',
    padding: '12px',
    background: 'rgba(220,38,38,0.06)',
    borderRadius: '10px',
  },
  nicknameInput: {
    maxWidth: '260px',
  },
});

export default function LiveClient() {
  const styles = useStyles();
  const pathname = usePathname();
  const eventCode = (pathname.split('/').filter(Boolean)[1] || '').toUpperCase();

  const [question, setQuestion] = useState<QuestionDoc | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [wordInput, setWordInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [nickname, setNickname] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [connStatus, setConnStatus] = useState<string>('connecting');
  const [error, setError] = useState('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceId = typeof window !== 'undefined' ? getDeviceId() : '';

  const answeredRef = useRef<Set<string>>(new Set());

  const handleMessage = useCallback((type: string, payload: any) => {
    if (type === 'active_question_changed') {
      const p = payload as ActiveQuestionPayload;
      setQuestion(p.question as QuestionDoc | null);
      setError('');
      if (p.question) {
        const alreadyAnswered = answeredRef.current.has(p.question.id);
        setSubmitted(alreadyAnswered);
        if (!alreadyAnswered) {
          setSelectedOption(null);
          setSelectedOptions([]);
          setWordInput('');
          if (p.question.type === 'quiz' && p.question.settings?.countdownSeconds) {
            setCountdown(p.question.settings.countdownSeconds);
          } else {
            setCountdown(null);
          }
        }
      } else {
        setSubmitted(false);
        setCountdown(null);
      }
    }
    setConnStatus(getConnectionStatus());
  }, []);

  useEffect(() => {
    if (!eventCode) return;
    connectSignalR(eventCode, handleMessage);
    const statusInterval = setInterval(() => {
      setConnStatus(getConnectionStatus());
    }, 3000);
    return () => {
      disconnectSignalR();
      clearInterval(statusInterval);
    };
  }, [eventCode, handleMessage]);

  // Quiz countdown timer
  useEffect(() => {
    if (countdown !== null && countdown > 0 && !submitted) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev !== null && prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [countdown !== null && countdown > 0, submitted]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNickname(localStorage.getItem('ec_nickname') || '');
    }
  }, []);

  const saveNickname = (n: string) => {
    setNickname(n);
    if (typeof window !== 'undefined') localStorage.setItem('ec_nickname', n);
  };

  const handleSubmit = async () => {
    if (!question) return;
    setError('');

    let answer: string | number | number[];
    if (question.type === 'wordcloud') {
      if (!wordInput.trim()) return;
      answer = wordInput.trim();
    } else if (question.type === 'quiz') {
      if (selectedOption === null) return;
      answer = selectedOption;
    } else if (question.type === 'poll') {
      if (question.settings?.multiSelect) {
        if (selectedOptions.length === 0) return;
        answer = selectedOptions;
      } else {
        if (selectedOption === null) return;
        answer = selectedOption;
      }
    } else {
      return;
    }

    try {
      await api.submitResponse({
        eventCode,
        questionId: question.id,
        answer,
        nickname: nickname || undefined,
        deviceId,
      });
      setSubmitted(true);
      answeredRef.current.add(question.id);
      setWordInput('');
    } catch (err: any) {
      if (err.message === 'Already answered') {
        setSubmitted(true);
        answeredRef.current.add(question.id);
      } else {
        setError(err.message);
      }
    }
  };

  const isTimedOut = countdown !== null && countdown <= 0;

  if (!eventCode) {
    return (
      <div className={styles.scene}>
        <p style={{ color: '#999', padding: '40px', textAlign: 'center' }}>No event code provided.</p>
      </div>
    );
  }

  return (
    <div className={styles.scene}>
      {/* Sticky top bar */}
      <div className={styles.topBar}>
        <div className={styles.statusDot}>
          <span
            className={styles.dot}
            style={{
              backgroundColor:
                connStatus === 'connected' ? '#10b981' : connStatus === 'polling' ? '#f59e0b' : '#ccc',
            }}
          />
          {connStatus === 'connected' ? 'Live' : connStatus === 'polling' ? 'Polling' : 'Connecting'}
        </div>
        <span className={styles.eventTag}>{eventCode}</span>
      </div>

      {/* Waiting state */}
      {!question && (
        <div className={styles.waiting}>
          <div className={styles.waitIcon}>⏳</div>
          <div className={styles.waitTitle}>Sit tight</div>
          <div className={styles.waitBody}>
            The host will launch the next activity shortly. Stay on this page.
          </div>
          <Input
            placeholder="Nickname (optional)"
            value={nickname}
            onChange={(_, d) => saveNickname(d.value)}
            className={styles.nicknameInput}
            appearance="filled-darker"
            style={{ borderRadius: '12px' }}
          />
        </div>
      )}

      {/* Active question */}
      {question && (
        <div className={styles.card}>
          <div className={styles.prompt}>{question.prompt}</div>

          {/* Quiz countdown */}
          {question.type === 'quiz' && countdown !== null && !submitted && (
            <div className={styles.countdown}>{countdown}s</div>
          )}

          {/* Submitted confirmation */}
          {submitted && (
            <div className={styles.submitted}>
              <CheckmarkCircleFilled className={styles.submittedIcon} />
              <div className={styles.submittedText}>
                {question.type === 'wordcloud'
                  ? 'Submitted! You can submit again after cooldown.'
                  : 'Answer locked in. Waiting for results\u2026'}
              </div>
            </div>
          )}

          {/* Word cloud input */}
          {question.type === 'wordcloud' && !isTimedOut && (
            <>
              <Input
                placeholder="Enter 1\u20133 words"
                value={wordInput}
                onChange={(_, d) => setWordInput(d.value.slice(0, 25))}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                disabled={submitted && question.type !== 'wordcloud'}
                maxLength={25}
                appearance="filled-darker"
                style={{ borderRadius: '12px' }}
              />
              <Button
                appearance="primary"
                onClick={handleSubmit}
                disabled={!wordInput.trim()}
                icon={<SendFilled />}
                iconPosition="after"
                style={{ borderRadius: '14px', height: '48px', fontWeight: 600 }}
              >
                Submit
              </Button>
            </>
          )}

          {/* Poll / Quiz options */}
          {(question.type === 'poll' || question.type === 'quiz') &&
            !submitted &&
            !isTimedOut && (
              <>
                {question.settings?.multiSelect ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {question.options?.map((opt: string, i: number) => {
                      const selected = selectedOptions.includes(i);
                      return (
                        <div
                          key={i}
                          className={`${styles.optionCard} ${selected ? styles.optionSelected : ''}`}
                          onClick={() => {
                            if (selected) {
                              setSelectedOptions(selectedOptions.filter((x) => x !== i));
                            } else {
                              setSelectedOptions([...selectedOptions, i]);
                            }
                          }}
                        >
                          <span className={styles.optionIndex}>{String.fromCharCode(65 + i)}</span>
                          <span className={styles.optionLabel}>{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {question.options?.map((opt: string, i: number) => {
                      const selected = selectedOption === i;
                      return (
                        <div
                          key={i}
                          className={`${styles.optionCard} ${selected ? styles.optionSelected : ''}`}
                          onClick={() => setSelectedOption(i)}
                        >
                          <span
                            className={styles.optionIndex}
                            style={selected ? { background: '#0078d4', color: '#fff' } : {}}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className={styles.optionLabel}>{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button
                  appearance="primary"
                  onClick={handleSubmit}
                  disabled={
                    question.settings?.multiSelect
                      ? selectedOptions.length === 0
                      : selectedOption === null
                  }
                  style={{ borderRadius: '14px', height: '48px', fontWeight: 600 }}
                >
                  {question.type === 'quiz' ? 'Lock In' : 'Vote'}
                </Button>
              </>
            )}

          {isTimedOut && !submitted && (
            <div className={styles.timedOut}>Time&apos;s up!</div>
          )}

          {error && <div className={styles.error}>{error}</div>}
        </div>
      )}
    </div>
  );
}
