'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Title1,
  Title3,
  Body1,
  Button,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';

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
    maxWidth: '420px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
    boxShadow: tokens.shadow28,
  },
  qr: {
    padding: tokens.spacingVerticalM,
    background: '#fff',
    borderRadius: tokens.borderRadiusLarge,
  },
  url: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
    wordBreak: 'break-all' as const,
    textAlign: 'center' as const,
  },
  title: { textAlign: 'center' as const },
});

export default function JoinClient() {
  const styles = useStyles();
  const pathname = usePathname();
  const router = useRouter();
  const eventCode = (pathname.split('/').filter(Boolean)[1] || '').toUpperCase();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventCode) { setLoading(false); setError('No event code'); return; }
    api.getEvent(eventCode)
      .then((e) => { setEvent(e); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [eventCode]);

  const liveUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/live/${eventCode}/`
    : `/live/${eventCode}/`;

  if (loading) {
    return (
      <div className={styles.container}>
        <Spinner size="large" label="Loading event..." />
      </div>
    );
  }

  if (error || !eventCode) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <Title3>Event Not Found</Title3>
          <Body1>Could not find event &ldquo;{eventCode}&rdquo;. Check the code and try again.</Body1>
          <Button appearance="primary" onClick={() => router.push('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <Title1 className={styles.title}>{event?.title || 'Event'}</Title1>
        <Body1>Scan the QR code or visit the link below to participate.</Body1>
        <div className={styles.qr}>
          <QRCodeSVG value={liveUrl} size={200} level="M" />
        </div>
        <div className={styles.url}>{liveUrl}</div>
        <Button
          appearance="primary"
          size="large"
          onClick={() => router.push(`/live/${eventCode}/`)}
        >
          Join Now
        </Button>
      </div>
    </div>
  );
}
