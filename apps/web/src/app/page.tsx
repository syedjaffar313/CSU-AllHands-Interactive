'use client';

import {
  Title1,
  Body1,
  Button,
  Input,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: tokens.spacingVerticalXXL,
    gap: tokens.spacingVerticalL,
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackgroundPressed} 100%)`,
  },
  card: {
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '400px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    boxShadow: tokens.shadow28,
  },
  title: {
    color: tokens.colorNeutralForeground1,
    textAlign: 'center' as const,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
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
    <div className={styles.container}>
      <div className={styles.card}>
        <Title1 className={styles.title}>Event Companion</Title1>
        <Body1 className={styles.subtitle}>
          Join your event with the code provided by the organizer.
        </Body1>
        <Input
          placeholder="Enter event code (e.g. CSU2026)"
          value={eventCode}
          onChange={(_, data) => setEventCode(data.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          size="large"
          style={{ textTransform: 'uppercase' }}
        />
        <Button
          appearance="primary"
          size="large"
          onClick={handleJoin}
          disabled={!eventCode.trim()}
        >
          Join Event
        </Button>
      </div>
    </div>
  );
}
