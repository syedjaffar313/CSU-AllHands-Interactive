'use client';

import {
  Button,
  Input,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ArrowRightFilled } from '@fluentui/react-icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const useStyles = makeStyles({
  scene: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '24px',
    position: 'relative' as const,
    overflow: 'hidden',
    background: 'radial-gradient(ellipse 120% 80% at 50% 0%, #e8f4fd 0%, #f6f9fc 40%, #ffffff 100%)',
  },
  /* Subtle grid pattern overlay */
  grid: {
    position: 'absolute' as const,
    inset: '0',
    backgroundImage:
      'linear-gradient(rgba(0,120,212,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,120,212,0.03) 1px, transparent 1px)',
    backgroundSize: '60px 60px',
    pointerEvents: 'none' as const,
  },
  /* Floating orbs for depth */
  orb1: {
    position: 'absolute' as const,
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,120,212,0.08) 0%, transparent 70%)',
    top: '-150px',
    right: '-100px',
    pointerEvents: 'none' as const,
  },
  orb2: {
    position: 'absolute' as const,
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(80,230,255,0.06) 0%, transparent 70%)',
    bottom: '-100px',
    left: '-100px',
    pointerEvents: 'none' as const,
  },
  content: {
    position: 'relative' as const,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
    maxWidth: '440px',
    width: '100%',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '100px',
    background: 'rgba(0, 120, 212, 0.08)',
    color: '#0078d4',
    fontSize: '13px',
    fontWeight: '600' as unknown as number,
    letterSpacing: '0.02em',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#0078d4',
    animation: 'pulse 2s ease-in-out infinite',
  },
  heading: {
    fontSize: 'clamp(2rem, 5vw, 3.2rem)',
    fontWeight: '800' as unknown as number,
    textAlign: 'center' as const,
    lineHeight: '1.1',
    letterSpacing: '-0.03em',
    color: '#1a1a1a',
  },
  headingAccent: {
    background: 'linear-gradient(135deg, #0078d4 0%, #50e6ff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '17px',
    color: '#666',
    textAlign: 'center' as const,
    lineHeight: '1.6',
    fontWeight: '400' as unknown as number,
    maxWidth: '360px',
  },
  card: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '28px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  inputWrapper: {
    position: 'relative' as const,
  },
  footer: {
    fontSize: '13px',
    color: '#999',
    textAlign: 'center' as const,
  },
});

export default function HomePage() {
  const styles = useStyles();
  const router = useRouter();
  const [eventCode, setEventCode] = useState('');

  const handleJoin = () => {
    const code = eventCode.trim().toUpperCase();
    if (code) {
      router.push(`/e/${code}`);
    }
  };

  return (
    <div className={styles.scene}>
      <div className={styles.grid} />
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.content}>
        <div className={styles.badge}>
          <span className={styles.dot} />
          Live Interactive Event
        </div>

        <h1 className={styles.heading}>
          Your voice,{' '}
          <span className={styles.headingAccent}>amplified.</span>
        </h1>

        <p className={styles.subtitle}>
          Join the conversation with polls, word clouds, and live quizzes.
          Enter your event code to get started.
        </p>

        <div className={styles.card}>
          <Input
            placeholder="Event code"
            value={eventCode}
            onChange={(_, data) => setEventCode(data.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            size="large"
            appearance="filled-darker"
            style={{
              textTransform: 'uppercase',
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}
          />
          <Button
            appearance="primary"
            size="large"
            onClick={handleJoin}
            disabled={!eventCode.trim()}
            icon={<ArrowRightFilled />}
            iconPosition="after"
            style={{
              borderRadius: '12px',
              height: '48px',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Join Event
          </Button>
        </div>

        <p className={styles.footer}>
          Powered by Microsoft &middot; CSU All Hands 2026
        </p>
      </div>
    </div>
  );
}
