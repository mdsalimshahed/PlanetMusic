/* --- src/components/Workspaces/Lyrics/LyricsEqualizer.jsx --- */
import React, { useEffect, useRef } from 'react';

const LyricsEqualizer = ({ isPlaying, isPlayingCurrentSong, disableAnimations, isEditing }) => {
  const canvasRef = useRef(null);
  const eqScalesRef = useRef(Array(40).fill(0.05));

  useEffect(() => {
    if (disableAnimations || isEditing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    let rafId = null;
    const pauseDecayFactor = 0.05; 
    let idleFrames = 0; 
    const numBars = 40;
    
    let cw = canvas.clientWidth;
    let ch = canvas.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        cw = entry.contentRect.width;
        ch = entry.contentRect.height;
        canvas.width = cw;
        canvas.height = ch;
      }
    });
    resizeObserver.observe(canvas);

    let lastPollTime = 0;
    const pollInterval = 1000 / 24; 
    const targetScales = new Float32Array(numBars).fill(0.05);

    const renderEQ = (timestamp) => {
      const displayWidth = cw;
      const displayHeight = ch;
      
      if (displayWidth === 0 || displayHeight === 0) {
        rafId = requestAnimationFrame(renderEQ);
        return;
      }

      const hasRealWebAudio = window.globalAudioAnalyser && window.globalFreqData;
      const currentScales = eqScalesRef.current;
      
      if (isPlaying && isPlayingCurrentSong && hasRealWebAudio) {
        idleFrames = 0;
        
        // We pull frequencies continuously at native frame rate.
        window.globalAudioAnalyser.getByteFrequencyData(window.globalFreqData);
        const freqData = window.globalFreqData;
        const bufferLength = freqData.length;
        
        let maxScale = 0;

        for (let i = 0; i < numBars; i++) {
          const percent = i / numBars;
          
          const dataIndex = Math.floor(Math.pow(percent, 1.5) * (bufferLength * 0.8));
          const safeIndex = Math.min(dataIndex, bufferLength - 1);
          
          const raw = freqData[safeIndex] || 0;
          const normalized = raw / 255;
          const emphasized = Math.pow(normalized, 1.5);
          
          const dampener = 0.6 + (percent * 0.6); 
          targetScales[i] = 0.05 + (emphasized * 1.8 * dampener);
          
          if (targetScales[i] > maxScale) {
            maxScale = targetScales[i];
          }
        }

        // DYNAMIC NORMALIZATION: Prevent the bars from hitting the ceiling and clipping
        if (maxScale > 0.95) {
          const normalizeFactor = 0.95 / maxScale;
          for (let i = 0; i < numBars; i++) {
            const dynamicPart = targetScales[i] - 0.05;
            targetScales[i] = 0.05 + (dynamicPart * normalizeFactor);
          }
        }

        // Native FPS INTERPOLATION
        for (let i = 0; i < numBars; i++) {
          if (targetScales[i] > currentScales[i]) {
            currentScales[i] += (targetScales[i] - currentScales[i]) * 0.45; 
          } else {
            currentScales[i] += (targetScales[i] - currentScales[i]) * 0.12; 
          }
        }
      } else {
        let allSettled = true;
        for (let i = 0; i < numBars; i++) {
          if (currentScales[i] > 0.051) {
            currentScales[i] += (0.05 - currentScales[i]) * pauseDecayFactor;
            allSettled = false;
          } else if (currentScales[i] !== 0.05) {
            currentScales[i] = 0.05;
            allSettled = false;
          }
        }
        if (allSettled) idleFrames++;
      }

      if (idleFrames > 5) {
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        rafId = null;
        return; 
      }

      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.fillStyle = '#ffffff';
      
      const barSpacing = displayWidth / numBars;
      const barWidth = Math.max(1, barSpacing * 0.75); 
      const startX = (barSpacing - barWidth) / 2; 

      ctx.beginPath();
      for (let i = 0; i < numBars; i++) {
        const barHeight = currentScales[i] * displayHeight;
        const x = startX + (i * barSpacing);
        const y = displayHeight - barHeight;
        const radius = Math.min(4, barHeight / 2);

        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
      }
      ctx.fill();

      rafId = requestAnimationFrame(renderEQ);
    };

    if (isPlaying && isPlayingCurrentSong) {
      rafId = requestAnimationFrame(renderEQ);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [isPlaying, isPlayingCurrentSong, disableAnimations, isEditing]);

  if (disableAnimations || isEditing) return null;

  return (
    <div className="lyrics-equalizer">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default LyricsEqualizer;