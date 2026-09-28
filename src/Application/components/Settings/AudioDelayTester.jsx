import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RUN_MS = 10000;
const TONE_INTERVAL_MS = 900;
const MAX_RESPONSE_MS = 1400;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const AudioDelayGraph = ({ taps, beeps, revealBeeps }) => {
  const width = 600;
  const height = 120;
  const baseline = 62;
  const xFor = (time) => Math.max(0, Math.min(width, (time / RUN_MS) * width));
  let trace = `M 0 ${baseline}`;

  taps.forEach((tap) => {
    const x = xFor(tap);
    trace += ` L ${Math.max(0, x - 8)} ${baseline} L ${x} 24 L ${Math.min(width, x + 8)} ${baseline}`;
  });
  trace += ` L ${width} ${baseline}`;

  return (
    <div className="audio-delay-graph-wrap">
      <svg className="audio-delay-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Ten-second response timeline">
        <line className="audio-delay-graph-grid" x1="0" y1={baseline} x2={width} y2={baseline} />
        {revealBeeps && beeps.map((beep, index) => (
          <line key={`beep-${index}`} className="audio-delay-beep-mark" x1={xFor(beep)} y1="20" x2={xFor(beep)} y2="102" />
        ))}
        <path className="audio-delay-tap-trace" d={trace} />
        <text className="audio-delay-axis-label" x="0" y="116">0s</text>
        <text className="audio-delay-axis-label" x={width} y="116" textAnchor="end">10s</text>
      </svg>
      <div className="audio-delay-legend">
        <span><i className="audio-delay-legend-tap" />Your taps</span>
        {revealBeeps && <span><i className="audio-delay-legend-beep" />Beep moments</span>}
      </div>
    </div>
  );
};

const AudioDelayTester = ({ settings, setSettings, returnPath }) => {
  const navigate = useNavigate();
  const [testState, setTestState] = useState('idle');
  const [remaining, setRemaining] = useState(RUN_MS);
  const [taps, setTaps] = useState([]);
  const [beeps, setBeeps] = useState([]);
  const [lastGraph, setLastGraph] = useState(() => settings?.audioDelayTestGraph || null);
  const [error, setError] = useState('');
  const activeRef = useRef(false);
  const contextRef = useRef(null);
  const startAtRef = useRef(0);
  const beepEventsRef = useRef([]);
  const tapEventsRef = useRef([]);
  const timersRef = useRef(new Set());
  const intervalRef = useRef(null);

  const stopTest = () => {
    activeRef.current = false;
    timersRef.current.forEach(timer => window.clearTimeout(timer));
    timersRef.current.clear();
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (contextRef.current) contextRef.current.close().catch(() => {});
    contextRef.current = null;
  };

  useEffect(() => () => stopTest(), []);

  const recordTap = () => {
    if (!activeRef.current) return;
    const time = performance.now() - startAtRef.current;
    const nextTaps = [...tapEventsRef.current, time];
    tapEventsRef.current = nextTaps;
    setTaps(nextTaps);
  };

  useEffect(() => {
    if (testState !== 'testing') return undefined;
    const onKeyDown = (event) => {
      if (event.code === 'ArrowDown') {
        event.preventDefault();
        recordTap();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [testState]);

  const startTest = async () => {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) {
      setError('Audio tests are not supported by this browser.');
      return;
    }

    stopTest();
    setError('');
    setTaps([]);
    setBeeps([]);
    tapEventsRef.current = [];
    beepEventsRef.current = [];

    try {
      const context = new AudioContextType();
      contextRef.current = context;
      await context.resume();
      startAtRef.current = performance.now();
      const endsAt = startAtRef.current + RUN_MS;
      activeRef.current = true;
      setTestState('testing');
      setRemaining(RUN_MS);

      const playTone = (when) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, when);
        gain.gain.exponentialRampToValueAtTime(0.12, when + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(when);
        oscillator.stop(when + 0.13);
      };

      const scheduleTone = (targetAt) => {
        if (targetAt >= endsAt) return;
        const timer = window.setTimeout(() => {
          timersRef.current.delete(timer);
          if (!activeRef.current) return;
          const toneAt = context.currentTime + 0.04;
          const outputTimestamp = context.getOutputTimestamp?.();
          const beepAt = outputTimestamp
            ? outputTimestamp.performanceTime + (toneAt - outputTimestamp.contextTime) * 1000 - startAtRef.current
            : performance.now() + 40 - startAtRef.current;
          beepEventsRef.current.push({ at: beepAt, matched: false });
          playTone(toneAt);
          scheduleTone(targetAt + TONE_INTERVAL_MS);
        }, Math.max(0, targetAt - performance.now()));
        timersRef.current.add(timer);
      };

      scheduleTone(startAtRef.current + 400);
      const finishTimer = window.setTimeout(() => {
        activeRef.current = false;
        const matchedDelays = [];
        tapEventsRef.current.forEach((tap) => {
          const candidate = [...beepEventsRef.current].reverse().find(beep => (
            !beep.matched && beep.at <= tap && tap - beep.at <= MAX_RESPONSE_MS
          ));
          if (candidate) {
            candidate.matched = true;
            matchedDelays.push(tap - candidate.at);
          }
        });
        const completedBeeps = beepEventsRef.current.map(beep => beep.at);
        const completedGraph = {
          taps: [...tapEventsRef.current],
          beeps: completedBeeps,
          delayMs: matchedDelays.length ? Math.round(median(matchedDelays)) : null,
          responseCount: matchedDelays.length,
          completedAt: new Date().toISOString()
        };
        setTaps(completedGraph.taps);
        setBeeps(completedBeeps);
        setLastGraph(completedGraph);
        setSettings({ ...settings, audioDelayTestGraph: completedGraph });
        setTestState('complete');
        setRemaining(0);
        stopTest();
      }, RUN_MS);
      timersRef.current.add(finishTimer);
      intervalRef.current = window.setInterval(() => {
        setRemaining(Math.max(0, endsAt - performance.now()));
      }, 100);
    } catch {
      stopTest();
      setTestState('idle');
      setError('Could not start audio. Check your output device and try again.');
    }
  };

  const graphTaps = testState === 'testing' ? taps : (lastGraph?.taps || []);
  const graphBeeps = testState === 'testing' ? beeps : (lastGraph?.beeps || []);
  const delayMs = testState === 'testing' ? null : (lastGraph?.delayMs ?? null);
  const savedMs = Number.isFinite(settings?.audioDelayCompensationMs) ? settings.audioDelayCompensationMs : null;
  const isAdjustmentSaved = delayMs !== null && savedMs === delayMs;

  const resetAdjustment = () => {
    const nextSettings = { ...settings };
    delete nextSettings.audioDelayCompensationMs;
    setSettings(nextSettings);
  };

  return (
    <section className="settings-card glass-panel audio-delay-card">
      <h3>Audio Delay Test</h3>
      <p className="setting-desc">Tap the button or press Arrow Down as each beep sounds for 10 seconds. Missed beeps are ignored. Your taps appear on the timeline; beep moments are revealed when the test ends. The estimate includes your response time, so use it as a personal sync adjustment.</p>
      {savedMs !== null && <p className="audio-delay-saved">Saved sync adjustment: <strong>{Math.round(savedMs)} ms</strong></p>}

      {(testState === 'testing' || lastGraph) && (
        <AudioDelayGraph taps={graphTaps} beeps={graphBeeps} revealBeeps={testState !== 'testing'} />
      )}

      {testState === 'testing' ? (
        <div className="audio-delay-test-controls">
          <span className="audio-delay-countdown" aria-live="polite">{Math.ceil(remaining / 1000)}s remaining · {taps.length} taps</span>
          <button
            type="button"
            className="experience-toggle active audio-delay-response-btn"
            onPointerDown={(event) => { event.preventDefault(); recordTap(); }}
            onClick={(event) => { if (event.detail === 0) recordTap(); }}
          >
            Tap when you hear a beep
          </button>
        </div>
      ) : lastGraph ? (
        <div className="audio-delay-result" role="status">
          {delayMs === null ? <p>No taps matched a beep. Missed inputs were ignored; run the test again when ready.</p> : <>
            <p>{testState === 'complete' ? 'Estimated response delay' : 'Last measured response delay'}</p>
            <strong>{delayMs} ms</strong>
            <span>{lastGraph.responseCount} matched responses</span>
          </>}
          <div className="audio-delay-actions">
            {isAdjustmentSaved ? (
              <button className="audio-delay-action-btn" onClick={resetAdjustment}>Reset adjustment</button>
            ) : delayMs !== null ? (
              <>
                <button className="audio-delay-action-btn" onClick={() => setSettings({ ...settings, audioDelayCompensationMs: delayMs })}>Save adjustment</button>
                <button className="audio-delay-action-btn" onClick={startTest}>Run again</button>
              </>
            ) : (
              <button className="audio-delay-action-btn" onClick={startTest}>Run again</button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" className="experience-toggle active audio-delay-start-btn" onClick={startTest}>Start 10-second test</button>
      )}
      {error && <p className="audio-delay-error" role="alert">{error}</p>}
      {returnPath && <button className="audio-delay-return-btn" onClick={() => navigate(returnPath)}>Return to Sync</button>}
    </section>
  );
};

export default AudioDelayTester;