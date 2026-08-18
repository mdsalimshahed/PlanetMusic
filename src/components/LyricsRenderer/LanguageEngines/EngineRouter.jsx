/* --- src/components/LyricsRenderer/LanguageEngines/EngineRouter.jsx --- */
import React from 'react';
import CJKEngine from './CJKEngine';
import RTLEngine from './RTLEngine';
import DefaultEngine from './DefaultEngine';
import { isRTLLanguage, isCJ, isBengaliLanguage } from '../textUtils';

const EngineRouter = ({ chars, lang, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct, isAdlib }) => {
    const cleanLang = (lang || 'auto').toLowerCase().trim();
    const textStr = originalText || '';
    const isCJKText = cleanLang === 'ja' || cleanLang.startsWith('zh') || cleanLang === 'ko' || (cleanLang === 'auto' && textStr.split('').some(isCJ));
    const isRTLText = cleanLang === 'ar' || cleanLang === 'he' || cleanLang === 'fa' || cleanLang === 'ur' || (cleanLang === 'auto' && isRTLLanguage(textStr));
    const isBengaliText = cleanLang === 'bn' || (cleanLang === 'auto' && isBengaliLanguage(textStr));

    if (isCJKText) {
        return CJKEngine({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct, isAdlib });
    }
        
    if (isRTLText) {
        return RTLEngine({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct, isAdlib });
    }

    return DefaultEngine({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct, isAdlib });
};

export default EngineRouter;