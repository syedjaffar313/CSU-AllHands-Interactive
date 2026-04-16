'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const EVENT_CODE = 'CSU2026';

export default function HomePage() {
  const [liveUrl, setLiveUrl] = useState('');
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLiveUrl(`${window.location.origin}/live/${EVENT_CODE}/`);
    }
  }, []);

  /* Intersection Observer for scroll-reveal */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('s-visible');
          }
        });
      },
      { threshold: 0.15 }
    );
    sectionsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const setRef = (i: number) => (el: HTMLDivElement | null) => {
    sectionsRef.current[i] = el;
  };

  return (
    <div className="story">
      {/* ─── Section 0 : Hero ─── */}
      <section className="s s-hero" ref={setRef(0)}>
        <div className="s-hero-grid" />
        <div className="s-hero-orb s-hero-orb--1" />
        <div className="s-hero-orb s-hero-orb--2" />
        <div className="s-hero-content s-reveal">
          <span className="s-hero-badge">
            <span className="s-hero-dot" />
            April 2026
          </span>
          <h1 className="s-hero-title">
            CSU All Hands
            <span className="s-hero-year">2026</span>
          </h1>
          <p className="s-hero-sub">Scroll to begin the experience</p>
          <div className="s-hero-chevron">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ─── Section 1 : Intro ─── */}
      <section className="s s-intro" ref={setRef(1)}>
        <div className="s-reveal">
          <span className="s-tag">What&apos;s happening</span>
          <h2 className="s-heading">
            Interactive<br />
            <span className="s-heading-accent">Activities.</span>
          </h2>
          <p className="s-body">
            Live polls, word clouds, and real-time quizzes &mdash;
            designed to make every voice in the room count.
          </p>
        </div>
      </section>

      {/* ─── Section 2 : Features ─── */}
      <section className="s s-features" ref={setRef(2)}>
        <div className="s-reveal">
          <div className="s-features-grid">
            <div className="s-feature-card">
              <div className="s-feature-icon">💬</div>
              <h3 className="s-feature-title">Word Cloud</h3>
              <p className="s-feature-body">
                Submit words and watch them grow on the big screen in real time.
              </p>
            </div>
            <div className="s-feature-card">
              <div className="s-feature-icon">📊</div>
              <h3 className="s-feature-title">Live Polls</h3>
              <p className="s-feature-body">
                Vote and see results animate instantly as the audience responds.
              </p>
            </div>
            <div className="s-feature-card">
              <div className="s-feature-icon">🧠</div>
              <h3 className="s-feature-title">Quizzes</h3>
              <p className="s-feature-body">
                Compete for the top of the leaderboard with timed quiz rounds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 3 : How it works ─── */}
      <section className="s s-how" ref={setRef(3)}>
        <div className="s-reveal">
          <span className="s-tag">How it works</span>
          <h2 className="s-heading">
            Scan.&nbsp;
            <span className="s-heading-accent">Participate.&nbsp;</span>
            Done.
          </h2>
          <div className="s-steps">
            <div className="s-step">
              <div className="s-step-num">1</div>
              <p className="s-step-text">Scan the QR code with your phone</p>
            </div>
            <div className="s-step-divider" />
            <div className="s-step">
              <div className="s-step-num">2</div>
              <p className="s-step-text">Answer questions as they appear live</p>
            </div>
            <div className="s-step-divider" />
            <div className="s-step">
              <div className="s-step-num">3</div>
              <p className="s-step-text">See your responses on the big screen</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 4 : QR Join ─── */}
      <section className="s s-join" ref={setRef(4)}>
        <div className="s-join-orb" />
        <div className="s-reveal">
          <span className="s-tag">Join now</span>
          <h2 className="s-heading" style={{ marginBottom: '32px' }}>
            Ready?<br />
            <span className="s-heading-accent">Scan to join.</span>
          </h2>

          <div className="s-qr-card">
            <div className="s-qr-wrap">
              {liveUrl && (
                <QRCodeSVG
                  value={liveUrl}
                  size={200}
                  level="M"
                  bgColor="transparent"
                  fgColor="#1a1a1a"
                />
              )}
            </div>
            <div className="s-qr-url">
              {typeof window !== 'undefined'
                ? `${window.location.host}/live/${EVENT_CODE}`
                : `/live/${EVENT_CODE}`}
            </div>
            <a className="s-qr-btn" href={`/live/${EVENT_CODE}/`}>
              Or tap here to join &rarr;
            </a>
          </div>

          <p className="s-footer">
            Powered by Microsoft &middot; CSU All Hands 2026
          </p>
        </div>
      </section>
    </div>
  );
}
