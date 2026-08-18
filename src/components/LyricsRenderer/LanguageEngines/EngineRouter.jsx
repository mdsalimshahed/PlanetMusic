/* --- src/components/LyricsRenderer/LanguageEngines/EngineRouter.jsx --- */
import React from 'react';
import CJKEngine from './CJKEngine';
import RTLEngine from './RTLEngine';
import DefaultEngine from './DefaultEngine';

const EngineRouter = ({ chars, lang, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct }) => {
    const cleanLang = (lang || 'auto').toLowerCase().trim();

    if (cleanLang === 'ja' || cleanLang.startsWith('zh') || cleanLang === 'ko') {
        return CJKEngine({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct });
    }
    
    if (cleanLang === 'ar' || cleanLang === 'he' || cleanLang === 'fa' || cleanLang === 'ur') {
        return RTLEngine({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct });
    }

    return DefaultEngine({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct });
};

export default EngineRouter;