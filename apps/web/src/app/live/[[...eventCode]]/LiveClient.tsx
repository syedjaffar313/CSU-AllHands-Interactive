'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Title2,
  Body1,
  Body2,
  Button,
  Input,
  RadioGroup,
  Radio,
  Checkbox,
  Badge,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { connectSignalR, disconnectSignalR, getConnectionStatus } from '@/lib/signalr';
import { api, getDeviceId } from '@/lib/api';
import type {
  QuestionDoc,
  ActiveQuestionPayload,
} from '@/types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    padding: tokens.spacingVerticalL,
    paddingBottom: '120px',
    background: tokens.colorNeutralBackground2,
  },
  header: {
    width: '100%',
    maxWidth: '500px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalS} 0`,
    marginBottom: tokens.spacingVerticalM,
  },
  card: {
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    padding: tokens.spacingVerticalXL,
    maxWidth: '500px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    boxShadow: tokens.shadow8,
  },
  waiting: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center' as const,
  },
  submitted: {
    textAlign: 'center' as const,
    color: tokens.colorStatusSuccessForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  countdown: {
    fontSize: tokens.fontSizeHero900,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorBrandForeground1,
    textAlign: 'center' as const,
  },
  prompt: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    textAlign: 'center' as const,
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
      <div className={styles.container}>
        <Body1>No event code provided.</Body1>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Badge
          appearance="filled"
          color={connStatus === 'connected' ? 'success' : connStatus === 'polling' ? 'warning' : 'informative'}
        >
          {connStatus === 'connected' ? 'Live' : connStatus === 'polling' ? 'Polling' : 'Connecting'}
        </Badge>
        <Body2>{eventCode}</Body2>
      </div>

      {!question && (
        <div className={styles.waiting}>
          <Spinner size="large" />
          <Title2>Waiting for the next activity...</Title2>
          <Body1>The host will launch a question shortly. Stay on this page.</Body1>
          <Input
            placeholder="Set your nickname (optional)"
            value={nickname}
            onChange={(_, d) => saveNickname(d.value)}
            style={{ maxWidth: 300 }}
          />
        </div>
      )}

      {question && (
        <div className={styles.card}>
          <div className={styles.prompt}>{question.prompt}</div>

          {question.type === 'quiz' && countdown !== null && !submitted && (
            <div className={styles.countdown}>{countdown}s</div>
          )}

          {submitted && (
            <div className={styles.submitted}>
              {question.type === 'wordcloud'
                ? 'Submitted! You can submit again after the cooldown.'
                : 'Answer submitted! Waiting for results...'}
            </div>
          )}

          {question.type === 'wordcloud' && !isTimedOut && (
            <>
              <Input
                placeholder="Enter 1-3 words (max 25 chars)"
                value={wordInput}
                onChange={(_, d) => setWordInput(d.value.slice(0, 25))}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                disabled={submitted && question.type !== 'wordcloud'}
                maxLength={25}
              />
              <Button
                appearance="primary"
                onClick={handleSubmit}
                disabled={!wordInput.trim()}
              >
                Submit
              </Button>
            </>
          )}

          {(question.type === 'poll' || question.type === 'quiz') &&
            !submitted &&
            !isTimedOut && (
              <>
                {question.settings?.multiSelect ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {question.options?.map((opt: string, i: number) => (
                      <Checkbox
                        key={i}
                        label={opt}
                        checked={selectedOptions.includes(i)}
                        onChange={(_, data) => {
                          if (data.checked) {
                            setSelectedOptions([...selectedOptions, i]);
                          } else {
                            setSelectedOptions(selectedOptions.filter((x) => x !== i));
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <RadioGroup
                    value={selectedOption !== null ? String(selectedOption) : ''}
                    onChange={(_, data) => setSelectedOption(Number(data.value))}
                  >
                    {question.options?.map((opt: string, i: number) => (
                      <Radio key={i} value={String(i)} label={opt} />
                    ))}
                  </RadioGroup>
                )}
                <Button
                  appearance="primary"
                  onClick={handleSubmit}
                  disabled={
                    question.settings?.multiSelect
                      ? selectedOptions.length === 0
                      : selectedOption === null
                  }
                >
                  {question.type === 'quiz' ? 'Lock In Answer' : 'Vote'}
                </Button>
              </>
            )}

          {isTimedOut && !submitted && (
            <Body1 style={{ textAlign: 'center', color: tokens.colorStatusDangerForeground1 }}>
              Time&apos;s up!
            </Body1>
          )}

          {error && (
            <Body1 style={{ color: tokens.colorStatusDangerForeground1, textAlign: 'center' }}>
              {error}
            </Body1>
          )}
        </div>
      )}
    </div>
  );
}
