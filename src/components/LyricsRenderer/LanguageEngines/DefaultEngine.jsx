/* --- src/components/LyricsRenderer/LanguageEngines/DefaultEngine.jsx --- */
import React from 'react';
import { normalizeTrans, parsePronunciation, getGraphemes, isCJ } from '../textUtils';
import { buildChunkElements, renderFormattedTranslation, getDisplayTranslation } from './EngineUtils';

const DefaultEngine = ({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct, isAdlib }) => {
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
                    const cClean = chunkText.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
                    const tClean = (chunk.trans || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
                    if (chunk.type === 'en' || (cClean && cClean === tClean)) {
                        alignedChunks.push({ type: 'en', trans: '', chars: chunkChars });
                    } else {
                        alignedChunks.push({ type: chunk.type || 'foreign', trans: chunk.trans, chars: chunkChars });
                    }
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

    const mainJSX = buildChunkElements(alignedChunks, masterPalette, isFocused, hasSpacingText, false, isHybridLine, isAdlib);

    let displayPronString = null;
    if (pronunciation && !pronunciation.startsWith('{') && !pronunciation.startsWith('[')) {
        const isCJKLine = chars.some(c => isCJ(c.char));
        if (!isCJKLine && !parsedChunks) {
            const cleanOrig = originalText.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
            const cleanPron = pronunciation.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
            if (cleanOrig !== cleanPron) {
                displayPronString = normalizeTrans(pronunciation, !isAdlib);
            }
        }
    }

    if (isAdlib && displayPronString) {
        displayPronString = displayPronString.replace(/[()\[\]{}（）]/g, '').trim();
    }

    const displayTrans = getDisplayTranslation(originalText, translation);
    const transJSX = displayTrans ? renderFormattedTranslation(displayTrans, isFocused) : null;
    const pronJSX = displayPronString ? renderFormattedTranslation(displayPronString, isFocused) : null;

    return { mainJSX, translationJSX: transJSX, pronunciationJSX: pronJSX };
};

export default DefaultEngine;