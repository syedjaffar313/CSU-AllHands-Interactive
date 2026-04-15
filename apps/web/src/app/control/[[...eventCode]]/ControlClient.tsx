'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Title1,
  Title3,
  Body1,
  Body2,
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  Divider,
  Spinner,
  Checkbox,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  PlayRegular,
  StopRegular,
  EyeRegular,
  DeleteRegular,
  ArrowDownloadRegular,
  AddRegular,
  DocumentBulletListRegular,
} from '@fluentui/react-icons';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { connectSignalR, disconnectSignalR, getConnectionStatus } from '@/lib/signalr';
import type { QuestionDoc } from '@/types';

const useStyles = makeStyles({
  container: {
    minHeight: '100vh',
    background: tokens.colorNeutralBackground2,
    padding: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalL,
    flexWrap: 'wrap' as const,
    gap: tokens.spacingVerticalS,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingVerticalL,
  },
  panel: {
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    padding: tokens.spacingVerticalL,
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusLarge,
  },
  questionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusLarge,
  },
  questionActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap' as const,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

export default function ControlClient() {
  const styles = useStyles();
  const params = useParams();
  const slugArray = params.eventCode as string[] | undefined;
  const eventCode = (slugArray?.[0] || '').toUpperCase();

  const [event, setEvent] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [connStatus, setConnStatus] = useState('connecting');

  // New question form
  const [newType, setNewType] = useState<string>('wordcloud');
  const [newPrompt, setNewPrompt] = useState('');
  const [newOptions, setNewOptions] = useState('');
  const [newCorrectIdx, setNewCorrectIdx] = useState('0');
  const [newCountdown, setNewCountdown] = useState('15');
  const [newMultiSelect, setNewMultiSelect] = useState(false);
  const [newHideResults, setNewHideResults] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    if (!eventCode) return;
    try {
      const [e, qs] = await Promise.all([
        api.getEvent(eventCode),
        api.listQuestions(eventCode),
      ]);
      setEvent(e);
      setQuestions(qs);
    } catch (err: any) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [eventCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMessage = useCallback((_type: string, _payload: any) => {
    loadData();
    setConnStatus(getConnectionStatus());
  }, [loadData]);

  useEffect(() => {
    if (!eventCode) return;
    connectSignalR(eventCode, handleMessage);
    return () => { disconnectSignalR(); };
  }, [eventCode, handleMessage]);

  const handleCreateQuestion = async () => {
    setCreating(true);
    try {
      const options = (newType === 'poll' || newType === 'quiz')
        ? newOptions.split('\n').map((o: string) => o.trim()).filter(Boolean)
        : undefined;

      await api.createQuestion({
        eventCode,
        type: newType,
        prompt: newPrompt,
        options,
        correctOptionIndex: newType === 'quiz' ? Number(newCorrectIdx) : undefined,
        settings: {
          countdownSeconds: newType === 'quiz' ? Number(newCountdown) : undefined,
          multiSelect: newType === 'poll' ? newMultiSelect : undefined,
          hideResultsWhileLive: newType === 'poll' ? newHideResults : undefined,
        },
      });
      setNewPrompt('');
      setNewOptions('');
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleLaunch = async (q: QuestionDoc) => {
    try { await api.launchQuestion(q.id, eventCode); await loadData(); }
    catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const handleClose = async (q: QuestionDoc) => {
    try { await api.closeQuestion(q.id, eventCode); await loadData(); }
    catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const handleReveal = async (q: QuestionDoc) => {
    try { await api.revealAnswer(q.id, eventCode); await loadData(); }
    catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const handleExport = async (q: QuestionDoc, format: 'json' | 'csv') => {
    try {
      const data = await api.exportResults(eventCode, q.id, format);
      const blob = new Blob(
        [format === 'csv' ? data : JSON.stringify(data, null, 2)],
        { type: format === 'csv' ? 'text/csv' : 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${eventCode}_${q.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  const handleSeed = async () => {
    try { await api.seedTemplates(eventCode); await loadData(); }
    catch (err: any) { alert(`Seed error: ${err.message}`); }
  };

  const handleDeleteEvent = async () => {
    if (!confirm(`Delete event ${eventCode} and ALL data? This cannot be undone.`)) return;
    try {
      await api.deleteEvent(eventCode);
      window.location.href = '/';
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const liveUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/e/${eventCode}/`
    : `/e/${eventCode}/`;
  const displayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/display/${eventCode}/`
    : `/display/${eventCode}/`;

  if (!eventCode) {
    return <div style={{ padding: 40 }}><Body1>No event code in URL.</Body1></div>;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spinner size="large" label="Loading control panel..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Title1>{event?.title || eventCode}</Title1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <Badge appearance="filled" color="brand">{eventCode}</Badge>
            <Badge
              appearance="filled"
              color={connStatus === 'connected' ? 'success' : 'warning'}
            >
              {connStatus}
            </Badge>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<DocumentBulletListRegular />} onClick={handleSeed}>
            Load Templates
          </Button>
          <Button icon={<DeleteRegular />} appearance="subtle" onClick={handleDeleteEvent}>
            Delete Event
          </Button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Left: QR + Create */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL }}>
          <div className={styles.panel}>
            <Title3>Audience Join</Title3>
            <div className={styles.qrSection}>
              <QRCodeSVG value={liveUrl} size={160} level="M" />
              <Body2 style={{ fontWeight: 600, wordBreak: 'break-all' }}>{liveUrl}</Body2>
            </div>
            <Divider />
            <Body2>
              <strong>Display view (projector):</strong>{' '}
              <a href={displayUrl} target="_blank" rel="noopener noreferrer">{displayUrl}</a>
            </Body2>
          </div>

          <div className={styles.panel}>
            <Title3>Create Question</Title3>
            <div className={styles.formGroup}>
              <Body2>Type</Body2>
              <Select value={newType} onChange={(_, d) => setNewType(d.value)}>
                <option value="wordcloud">Word Cloud</option>
                <option value="poll">Poll</option>
                <option value="quiz">Quiz</option>
              </Select>
            </div>
            <div className={styles.formGroup}>
              <Body2>Prompt</Body2>
              <Input
                placeholder="Enter the question or prompt"
                value={newPrompt}
                onChange={(_, d) => setNewPrompt(d.value)}
              />
            </div>
            {(newType === 'poll' || newType === 'quiz') && (
              <div className={styles.formGroup}>
                <Body2>Options (one per line)</Body2>
                <Textarea
                  placeholder={"Option A\nOption B\nOption C"}
                  value={newOptions}
                  onChange={(_, d) => setNewOptions(d.value)}
                  rows={4}
                />
              </div>
            )}
            {newType === 'quiz' && (
              <>
                <div className={styles.formGroup}>
                  <Body2>Correct option index (0-based)</Body2>
                  <Input type="number" value={newCorrectIdx} onChange={(_, d) => setNewCorrectIdx(d.value)} min="0" />
                </div>
                <div className={styles.formGroup}>
                  <Body2>Countdown (seconds)</Body2>
                  <Input type="number" value={newCountdown} onChange={(_, d) => setNewCountdown(d.value)} min="5" max="120" />
                </div>
              </>
            )}
            {newType === 'poll' && (
              <div style={{ display: 'flex', gap: 16 }}>
                <Checkbox label="Multi-select" checked={newMultiSelect} onChange={(_, d) => setNewMultiSelect(!!d.checked)} />
                <Checkbox label="Hide results while live" checked={newHideResults} onChange={(_, d) => setNewHideResults(!!d.checked)} />
              </div>
            )}
            <Button
              appearance="primary"
              icon={<AddRegular />}
              onClick={handleCreateQuestion}
              disabled={!newPrompt.trim() || creating}
            >
              Create Question
            </Button>
          </div>
        </div>

        {/* Right: Questions */}
        <div className={styles.panel}>
          <Title3>Questions ({questions.length})</Title3>
          {questions.length === 0 && (
            <Body1 style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', padding: 32 }}>
              No questions yet. Create one or load templates.
            </Body1>
          )}
          {questions.map((q: QuestionDoc) => (
            <div key={q.id} className={styles.questionCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <Body1 style={{ fontWeight: 600 }}>{q.prompt}</Body1>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <Badge appearance="outline">{q.type}</Badge>
                    <Badge
                      appearance="filled"
                      color={
                        q.status === 'LIVE' ? 'success' :
                        q.status === 'CLOSED' ? 'danger' :
                        q.status === 'DRAFT' ? 'informative' : 'subtle'
                      }
                    >
                      {q.status}
                    </Badge>
                  </div>
                </div>
              </div>
              {q.options && (
                <Body2 style={{ color: tokens.colorNeutralForeground3 }}>
                  Options: {q.options.join(' | ')}
                </Body2>
              )}
              <div className={styles.questionActions}>
                {q.status === 'DRAFT' && (
                  <Button size="small" appearance="primary" icon={<PlayRegular />} onClick={() => handleLaunch(q)}>
                    Launch
                  </Button>
                )}
                {q.status === 'LIVE' && (
                  <Button size="small" appearance="primary" icon={<StopRegular />} onClick={() => handleClose(q)}>
                    Close
                  </Button>
                )}
                {q.type === 'quiz' && (q.status === 'LIVE' || q.status === 'CLOSED') && (
                  <Button size="small" appearance="secondary" icon={<EyeRegular />} onClick={() => handleReveal(q)}>
                    Reveal Answer
                  </Button>
                )}
                {q.status === 'CLOSED' && (
                  <>
                    <Button size="small" appearance="subtle" icon={<ArrowDownloadRegular />} onClick={() => handleExport(q, 'csv')}>CSV</Button>
                    <Button size="small" appearance="subtle" icon={<ArrowDownloadRegular />} onClick={() => handleExport(q, 'json')}>JSON</Button>
                  </>
                )}
                {(q.status === 'CLOSED' || q.status === 'DRAFT') && (
                  <Button size="small" appearance="secondary" icon={<PlayRegular />} onClick={() => handleLaunch(q)}>
                    {q.status === 'CLOSED' ? 'Re-launch' : 'Launch'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
