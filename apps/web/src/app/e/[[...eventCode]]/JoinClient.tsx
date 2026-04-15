'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Button,
  Spinner,
  makeStyles,
} from '@fluentui/react-components';
import { ArrowRightFilled, ShareFilled } from '@fluentui/react-icons';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';

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
  orb: {
    position: 'absolute' as const,
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,120,212,0.06) 0%, transparent 70%)',
    top: '-200px',
    left: '50%',
    transform: 'translateX(-50%)',
    pointerEvents: 'none' as const,
  },
  content: {
    position: 'relative' as const,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '28px',
    maxWidth: '420px',
    width: '100%',
  },
  eventName: {
    fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
    fontWeight: '800' as unknown as number,
    textAlign: 'center' as const,
    lineHeight: '1.15',
    letterSpacing: '-0.02em',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: '16px',
    color: '#888',
    textAlign: 'center' as const,
    lineHeight: '1.5',
  },
  qrCard: {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '32px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  qrWrapper: {
    padding: '16px',
    background: '#fafafa',
    borderRadius: '16px',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  urlPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '100px',
    background: 'rgba(0, 120, 212, 0.06)',
    color: '#0078d4',
    fontSize: '13px',
    fontWeight: '600' as unknown as number,
    wordBreak: 'break-all' as const,
    textAlign: 'center' as const,
    maxWidth: '100%',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  errorCard: {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '48px 32px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    textAlign: 'center' as const,
  },
  errorIcon: {
    fontSize: '48px',
    lineHeight: '1',
  },
  errorTitle: {
    fontSize: '22px',
    fontWeight: '700' as unknown as number,
    color: '#1a1a1a',
  },
  errorBody: {
    fontSize: '15px',
    color: '#888',
    lineHeight: '1.5',
  },
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

  const shortUrl = typeof window !== 'undefined'
    ? `${window.location.host}/live/${eventCode}`
    : `/live/${eventCode}`;

  if (loading) {
    return (
      <div className={styles.scene}>
        <Spinner size="large" />
      </div>
    );
  }

  if (error || !eventCode) {
    return (
      <div className={styles.scene}>
        <div className={styles.orb} />
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>🔍</div>
          <div className={styles.errorTitle}>Event not found</div>
          <div className={styles.errorBody}>
            We couldn&apos;t find an event with code &ldquo;{eventCode}&rdquo;.
            <br />Double-check the code and try again.
          </div>
          <Button
            appearance="primary"
            onClick={() => router.push('/')}
            style={{ borderRadius: '12px', marginTop: '8px' }}
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scene}>
      <div className={styles.orb} />

      <div className={styles.content}>
        <h1 className={styles.eventName}>{event?.title || 'Event'}</h1>
        <p className={styles.subtitle}>
          Scan the QR code to join on your phone,
          or tap the button below.
        </p>

        <div className={styles.qrCard}>
          <div className={styles.qrWrapper}>
            <QRCodeSVG
              value={liveUrl}
              size={180}
              level="M"
              bgColor="transparent"
              fgColor="#1a1a1a"
            />
          </div>
          <div className={styles.urlPill}>
            <ShareFilled fontSize={14} />
            {shortUrl}
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            appearance="primary"
            size="large"
            onClick={() => router.push(`/live/${eventCode}/`)}
            icon={<ArrowRightFilled />}
            iconPosition="after"
            style={{
              borderRadius: '14px',
              height: '52px',
              fontSize: '16px',
              fontWeight: 600,
              flex: 1,
            }}
          >
            Join Now
          </Button>
        </div>
      </div>
    </div>
  );
}
