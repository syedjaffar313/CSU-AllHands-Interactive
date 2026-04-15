'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Title3,
  Body1,
  Badge,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { motion, AnimatePresence } from 'framer-motion';
import { connectSignalR, disconnectSignalR, getConnectionStatus } from '@/lib/signalr';
import type {
  QuestionDoc,
  WordCloudTally,
  PollTally,
  QuizState,
  ResultsUpdatedPayload,
  ActiveQuestionPayload,
} from '@/types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f1b2d 0%, #1a365d 50%, #0f1b2d 100%)',
    color: '#ffffff',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  header: {
    position: 'absolute' as const,
    top: tokens.spacingVerticalL,
    left: tokens.spacingHorizontalXL,
    right: tokens.spacingHorizontalXL,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  prompt: {
    fontSize: '2.5rem',
    fontWeight: tokens.fontWeightBold,
    color: '#ffffff',
    textAlign: 'center' as const,
    marginBottom: tokens.spacingVerticalXXL,
    maxWidth: '80%',
  },
  waiting: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXL,
  },
  waitingTitle: {
    fontSize: '3rem',
    fontWeight: tokens.fontWeightBold,
    color: 'rgba(255,255,255,0.9)',
  },
  wordCloudContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '90vw',
    maxHeight: '70vh',
    padding: tokens.spacingVerticalXL,
  },
  pollContainer: {
    width: '80vw',
    maxWidth: '900px',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  pollBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
  },
  pollLabel: {
    minWidth: '200px',
    fontSize: '1.5rem',
    fontWeight: tokens.fontWeightSemibold,
    color: '#ffffff',
    textAlign: 'right' as const,
  },
  pollBarOuter: {
    flex: 1,
    height: '48px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '24px',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  pollBarInner: {
    height: '100%',
    borderRadius: '24px',
    background: 'linear-gradient(90deg, #0078d4, #50e6ff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '16px',
    minWidth: '48px',
  },
  pollCount: {
    fontSize: '1.2rem',
    fontWeight: tokens.fontWeightBold,
    color: '#ffffff',
    minWidth: '80px',
    textAlign: 'left' as const,
  },
  quizContainer: {
    width: '80vw',
    maxWidth: '900px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
  },
  leaderboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    width: '100%',
    maxWidth: '600px',
  },
  leaderboardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    padding: tokens.spacingVerticalM,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: tokens.borderRadiusLarge,
  },
  rank: {
    fontSize: '2rem',
    fontWeight: tokens.fontWeightBold,
    width: '50px',
    textAlign: 'center' as const,
  },
  statusIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    display: 'inline-block',
  },
});

export default function DisplayClient() {
  const styles = useStyles();
  const pathname = usePathname();
  const eventCode = (pathname.split('/').filter(Boolean)[1] || '').toUpperCase();

  const [question, setQuestion] = useState<QuestionDoc | null>(null);
  const [wordcloud, setWordcloud] = useState<WordCloudTally | null>(null);
  const [poll, setPoll] = useState<PollTally | null>(null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [connStatus, setConnStatus] = useState('connecting');

  const handleMessage = useCallback((type: string, payload: any) => {
    if (type === 'active_question_changed') {
      const p = payload as ActiveQuestionPayload;
      setQuestion(p.question as QuestionDoc | null);
      setWordcloud(null);
      setPoll(null);
      setQuiz(null);
    } else if (type === 'results_updated') {
      const p = payload as ResultsUpdatedPayload;
      if (p.wordcloud) setWordcloud(p.wordcloud);
      if (p.poll) setPoll(p.poll);
      if (p.quiz) setQuiz(p.quiz);
    }
    setConnStatus(getConnectionStatus());
  }, []);

  useEffect(() => {
    if (!eventCode) return;
    connectSignalR(eventCode, handleMessage);
    const statusInterval = setInterval(() => {
      setConnStatus(getConnectionStatus());
    }, 5000);
    return () => {
      disconnectSignalR();
      clearInterval(statusInterval);
    };
  }, [eventCode, handleMessage]);

  const getWordFontSize = (count: number, max: number): number => {
    if (max <= 1) return 48;
    const minSize = 16;
    const maxSize = 110;
    return Math.round(minSize + ((count / max) * (maxSize - minSize)));
  };

  const maxWordCount = wordcloud
    ? Math.max(...wordcloud.words.map((w: { text: string; count: number }) => w.count), 1)
    : 1;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Badge appearance="outline" color="informative" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
          {eventCode}
        </Badge>
        <div
          className={styles.statusIndicator}
          style={{
            backgroundColor:
              connStatus === 'connected' ? '#6ccb5f' : connStatus === 'polling' ? '#ffaa44' : '#888',
          }}
        />
      </div>

      {!question && (
        <AnimatePresence>
          <motion.div
            className={styles.waiting}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.waitingTitle}>CSU All Hands</div>
            <Body1 style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.6)' }}>
              Waiting for the next activity...
            </Body1>
          </motion.div>
        </AnimatePresence>
      )}

      {question && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
        >
          <div className={styles.prompt}>{question.prompt}</div>

          {question.type === 'wordcloud' && wordcloud && (
            <div className={styles.wordCloudContainer}>
              <AnimatePresence>
                {wordcloud.words.map((w: { text: string; count: number }) => (
                  <motion.span
                    key={w.text}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    style={{
                      fontSize: `${getWordFontSize(w.count, maxWordCount)}px`,
                      fontWeight: w.count > maxWordCount * 0.5 ? 700 : 400,
                      color: `hsl(${200 + (w.count * 30) % 60}, 80%, ${60 + (w.count * 5) % 30}%)`,
                      padding: '4px 8px',
                      display: 'inline-block',
                      lineHeight: 1.2,
                    }}
                  >
                    {w.text}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          )}

          {question.type === 'wordcloud' && !wordcloud && (
            <Body1 style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.5)' }}>
              Waiting for submissions...
            </Body1>
          )}

          {question.type === 'poll' && poll && (
            <div className={styles.pollContainer}>
              {poll.options.map((opt: { label: string; count: number; percent: number }, i: number) => (
                <div key={i} className={styles.pollBar}>
                  <div className={styles.pollLabel}>{opt.label}</div>
                  <div className={styles.pollBarOuter}>
                    <motion.div
                      className={styles.pollBarInner}
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.max(opt.percent, 5)}%` }}
                      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    />
                  </div>
                  <div className={styles.pollCount}>
                    {opt.count} ({opt.percent}%)
                  </div>
                </div>
              ))}
              <Body1 style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>
                {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
              </Body1>
            </div>
          )}

          {question.type === 'poll' && !poll && (
            <Body1 style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.5)' }}>
              Collecting votes...
            </Body1>
          )}

          {question.type === 'quiz' && (
            <div className={styles.quizContainer}>
              {question.options?.map((opt: string, i: number) => {
                const isCorrect = quiz?.correctOptionIndex === i;
                const isRevealed = quiz?.correctOptionIndex !== undefined;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      width: '100%',
                      padding: '16px 24px',
                      background: isRevealed && isCorrect
                        ? 'rgba(108, 203, 95, 0.3)'
                        : 'rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      fontSize: '1.5rem',
                      border: isRevealed && isCorrect ? '2px solid #6ccb5f' : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#50e6ff' }}>
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                    {isRevealed && isCorrect && (
                      <span style={{ marginLeft: 'auto', color: '#6ccb5f' }}>&#10003;</span>
                    )}
                  </motion.div>
                );
              })}

              {quiz?.stats && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ textAlign: 'center', marginTop: 16 }}
                >
                  <Body1 style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.7)' }}>
                    {quiz.stats.totalAnswered} answered &middot; {quiz.stats.percentCorrect}% correct
                  </Body1>
                </motion.div>
              )}

              {quiz?.leaderboard && quiz.leaderboard.length > 0 && (
                <motion.div
                  className={styles.leaderboard}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Title3 style={{ textAlign: 'center', color: '#50e6ff', marginBottom: 8 }}>
                    Top 3
                  </Title3>
                  {quiz.leaderboard.map((entry: { rank: number; nickname: string; score: number }) => (
                    <div key={entry.rank} className={styles.leaderboardRow}>
                      <div className={styles.rank}>
                        {entry.rank === 1 ? '1st' : entry.rank === 2 ? '2nd' : '3rd'}
                      </div>
                      <div style={{ flex: 1, fontSize: '1.3rem' }}>{entry.nickname}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#50e6ff' }}>
                        {entry.score} pts
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
