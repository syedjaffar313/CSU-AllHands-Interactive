'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  makeStyles,
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
  scene: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'radial-gradient(ellipse 140% 100% at 50% 10%, #0d1f3c 0%, #080e1a 60%, #040810 100%)',
    color: '#ffffff',
    overflow: 'hidden',
    position: 'relative' as const,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  grid: {
    position: 'absolute' as const,
    inset: '0',
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
    backgroundSize: '80px 80px',
    pointerEvents: 'none' as const,
  },
  topBar: {
    position: 'absolute' as const,
    top: '28px',
    left: '40px',
    right: '40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  eventTag: {
    fontSize: '12px',
    fontWeight: '700' as unknown as number,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.3)',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  prompt: {
    fontSize: 'clamp(2rem, 4vw, 3.2rem)',
    fontWeight: '800' as unknown as number,
    color: '#ffffff',
    textAlign: 'center' as const,
    marginBottom: '48px',
    maxWidth: '80%',
    lineHeight: '1.15',
    letterSpacing: '-0.02em',
    position: 'relative' as const,
    zIndex: 2,
  },
  waiting: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    position: 'relative' as const,
    zIndex: 2,
  },
  waitTitle: {
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: '800' as unknown as number,
    letterSpacing: '-0.03em',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  waitSub: {
    fontSize: '1.2rem',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '400' as unknown as number,
  },
  wordCloudContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    alignItems: 'center',
    gap: '14px',
    maxWidth: '88vw',
    maxHeight: '65vh',
    padding: '32px',
    position: 'relative' as const,
    zIndex: 2,
  },
  pollContainer: {
    width: '80vw',
    maxWidth: '860px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'relative' as const,
    zIndex: 2,
  },
  pollRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  pollLabel: {
    minWidth: '180px',
    fontSize: '1.3rem',
    fontWeight: '600' as unknown as number,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'right' as const,
  },
  pollTrack: {
    flex: 1,
    height: '44px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '22px',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  pollFill: {
    height: '100%',
    borderRadius: '22px',
    background: 'linear-gradient(90deg, #0078d4, #50e6ff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '14px',
    minWidth: '44px',
  },
  pollCount: {
    fontSize: '1.1rem',
    fontWeight: '700' as unknown as number,
    color: 'rgba(255,255,255,0.5)',
    minWidth: '90px',
    textAlign: 'left' as const,
  },
  pollTotal: {
    textAlign: 'center' as const,
    color: 'rgba(255,255,255,0.3)',
    fontSize: '1rem',
    marginTop: '12px',
  },
  quizContainer: {
    width: '80vw',
    maxWidth: '860px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    position: 'relative' as const,
    zIndex: 2,
  },
  quizOption: {
    width: '100%',
    padding: '18px 28px',
    borderRadius: '16px',
    fontSize: '1.35rem',
    fontWeight: '500' as unknown as number,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    border: '1.5px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.04)',
  },
  quizOptionCorrect: {
    background: 'rgba(16,185,129,0.15)',
    border: '1.5px solid rgba(16,185,129,0.5)',
  },
  quizIndex: {
    fontWeight: '700' as unknown as number,
    color: '#50e6ff',
    fontSize: '1.1rem',
    minWidth: '28px',
  },
  leaderboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '560px',
    marginTop: '20px',
  },
  leaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '14px 20px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  rank: {
    fontSize: '1.8rem',
    fontWeight: '800' as unknown as number,
    width: '48px',
    textAlign: 'center' as const,
    background: 'linear-gradient(135deg, #50e6ff, #0078d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  emptyHint: {
    fontSize: '1.3rem',
    color: 'rgba(255,255,255,0.3)',
    position: 'relative' as const,
    zIndex: 2,
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
    <div className={styles.scene}>
      <div className={styles.grid} />

      <div className={styles.topBar}>
        <span className={styles.eventTag}>{eventCode}</span>
        <span
          className={styles.statusDot}
          style={{
            backgroundColor:
              connStatus === 'connected' ? '#10b981' : connStatus === 'polling' ? '#f59e0b' : '#555',
            boxShadow:
              connStatus === 'connected' ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
          }}
        />
      </div>

      {!question && (
        <AnimatePresence>
          <motion.div
            className={styles.waiting}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.waitTitle}>CSU All Hands</div>
            <div className={styles.waitSub}>Waiting for the next activity&hellip;</div>
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

          {/* Word cloud */}
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
                      color: `hsl(${200 + (w.count * 30) % 60}, 70%, ${55 + (w.count * 5) % 30}%)`,
                      padding: '4px 10px',
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
            <div className={styles.emptyHint}>Waiting for submissions&hellip;</div>
          )}

          {/* Poll bars */}
          {question.type === 'poll' && poll && (
            <div className={styles.pollContainer}>
              {poll.options.map((opt: { label: string; count: number; percent: number }, i: number) => (
                <div key={i} className={styles.pollRow}>
                  <div className={styles.pollLabel}>{opt.label}</div>
                  <div className={styles.pollTrack}>
                    <motion.div
                      className={styles.pollFill}
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.max(opt.percent, 4)}%` }}
                      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    />
                  </div>
                  <div className={styles.pollCount}>
                    {opt.count} ({opt.percent}%)
                  </div>
                </div>
              ))}
              <div className={styles.pollTotal}>
                {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          {question.type === 'poll' && !poll && (
            <div className={styles.emptyHint}>Collecting votes&hellip;</div>
          )}

          {/* Quiz */}
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
                    transition={{ delay: i * 0.08 }}
                    className={`${styles.quizOption} ${isRevealed && isCorrect ? styles.quizOptionCorrect : ''}`}
                  >
                    <span className={styles.quizIndex}>
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                    {isRevealed && isCorrect && (
                      <span style={{ marginLeft: 'auto', color: '#10b981', fontWeight: 700 }}>✓</span>
                    )}
                  </motion.div>
                );
              })}

              {quiz?.stats && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ textAlign: 'center', marginTop: '16px', color: 'rgba(255,255,255,0.45)', fontSize: '1.1rem' }}
                >
                  {quiz.stats.totalAnswered} answered &middot; {quiz.stats.percentCorrect}% correct
                </motion.div>
              )}

              {quiz?.leaderboard && quiz.leaderboard.length > 0 && (
                <motion.div
                  className={styles.leaderboard}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div style={{ textAlign: 'center', color: '#50e6ff', fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px', letterSpacing: '-0.01em' }}>
                    Top 3
                  </div>
                  {quiz.leaderboard.map((entry: { rank: number; nickname: string; score: number }) => (
                    <div key={entry.rank} className={styles.leaderRow}>
                      <div className={styles.rank}>
                        {entry.rank === 1 ? '1st' : entry.rank === 2 ? '2nd' : '3rd'}
                      </div>
                      <div style={{ flex: 1, fontSize: '1.2rem', fontWeight: 500 }}>{entry.nickname}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#50e6ff' }}>
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
