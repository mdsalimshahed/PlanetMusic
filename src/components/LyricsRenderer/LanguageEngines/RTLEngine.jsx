/* --- src/components/LyricsRenderer/LanguageEngines/RTLEngine.jsx --- */
import React from 'react';
import { normalizeTrans, parsePronunciation, getGraphemes } from '../textUtils';
import { buildChunkElements, renderFormattedTranslation, getDisplayTranslation } from './EngineUtils';

const RTLEngine = ({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct }) => {
    const { parsedChunks, fullTrans } = parsePronunciation(pronunciation);
    let alignedChunks = [];

    if (isOnlyPunct) {
        alignedChunks.push({ type: 'main', trans: '', chars });
    } else {
        if (parsedChunks && Array.isArray(parsedChunks)) {
            let charIdxPointer = 0;
            parsedChunks.forEach((chunk) => {
                const chunkText = chunk.text || '';
                const nonSpaceGraphemes = getGraphemes(chunkText.replace(/\s+/g, ''));
                let charsToConsume = 0;
                let tempPointer = charIdxPointer;

                if (nonSpaceGraphemes.length > 0) {
                    let matched = 0;
                    while (matched < nonSpaceGraphemes.length && tempPointer < chars.length) {
                        if (!/\s/.test(chars[tempPointer].char)) matched++;
                        charsToConsume++;
                        tempPointer++;
                    }
                } else {
                    while (tempPointer < chars.length && /\s/.test(chars[tempPointer].char)) {
                        charsToConsume++;
                        tempPointer++;
                    }
                }

                const chunkChars = chars.slice(charIdxPointer, charIdxPointer + charsToConsume);
                charIdxPointer += charsToConsume;

                if (chunkChars.length > 0) {
                    alignedChunks.push({ type: chunk.type || 'foreign', trans: chunk.trans, chars: chunkChars });
                }
            });
            
            if (charIdxPointer < chars.length) {
                alignedChunks.push({ type: 'main', trans: '', chars: chars.slice(charIdxPointer) });
            }
        } else {
            let currentSeg = null;
            let currentChars = [];
            chars.forEach(c => {
                if (currentSeg === null) currentSeg = c.seg;
                if (currentSeg === c.seg) {
                    currentChars.push(c);
                } else {
                    alignedChunks.push({ type: 'main', trans: '', chars: currentChars });
                    currentChars = [c];
                    currentSeg = c.seg;
                }
            });
            if (currentChars.length > 0) {
                alignedChunks.push({ type: 'main', trans: fullTrans || '', chars: currentChars });
            }
        }
    }

    const hasInlinePronunciation = alignedChunks.some(chunk => chunk.type !== 'en' && chunk.trans && chunk.trans.trim());
    const hasVisibleNonPronunciation = alignedChunks.some(chunk => (chunk.type === 'en' || !chunk.trans || !chunk.trans.trim()) && chunk.chars.some(c => c.char.trim() !== ''));
    const isHybridLine = hasInlinePronunciation && hasVisibleNonPronunciation;

    const mainJSX = buildChunkElements(alignedChunks, masterPalette, isFocused, hasSpacingText, true, isHybridLine);

    let displayPronString = null;
    if (fullTrans) {
        displayPronString = normalizeTrans(fullTrans);
    } else if (parsedChunks) {
        displayPronString = parsedChunks.map(c => normalizeTrans(c.trans || c.text)).filter(Boolean).join(' ');
    }

    const displayTrans = getDisplayTranslation(originalText, translation);
    const transJSX = displayTrans ? renderFormattedTranslation(displayTrans, isFocused) : null;
    const pronJSX = displayPronString ? renderFormattedTranslation(displayPronString, isFocused) : null;

    return { mainJSX, translationJSX: transJSX, pronunciationJSX: pronJSX };
};

export default RTLEngine;