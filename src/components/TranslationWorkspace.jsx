/* --- src/components/TranslationWorkspace.jsx --- */
import React, { useState, useEffect } from 'react';
import { getBulkPronunciations, forceSaveToCache } from '../transliterator';
import './TranslationWorkspace.css';

const TranslationWorkspace = ({
  selectedSong, customData, masterPalette, updateSongInLibrary, setIsTranslationManagerOpen, setNotification }) => {
  const [workspaceData, setWorkspaceData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [activeTranslatingIndex, setActiveTranslatingIndex] = useState(-1);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const initData = () => {
      let sourceData = selectedSong.syncData || selectedSong.autoSyncData || [];
      const mapped = [];
      sourceData.forEach((line, i) => {
          let mainText = line.text;
          
          if (line.isSplit && line.adlibs) {
              line.adlibs.forEach(a => {
                  mainText = mainText.replace(a.text, '');
              });
              mainText = mainText.replace(/\s+/g, ' ').trim();
          }
          let pron = line.pronunciation || '';
          let displayPron = pron;
          
          if (typeof pron === 'string') {
              if (pron.startsWith('{')) {
                  try {
                      const p = JSON.parse(pron);
                      displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
                  } catch(e){}
              } else if (pron.startsWith('[')) {
                  try {
                      const p = JSON.parse(pron);
                      displayPron = p.map(c => c.trans || c.text).join('');
                  } catch(e){}
              }
          }
          mapped.push({
             ...line,
             displayText: mainText || line.text,
             translation: line.translation || '',
             pronunciation: pron,
             displayPron: displayPron,
             _meta: { isAdlib: false, lineIndex: i }
          });
          if (line.isSplit && line.adlibs) {
              line.adlibs.forEach((adlib, j) => {
                  let aPron = adlib.pronunciation || '';
                  let aDisplayPron = aPron;
                  
                  if (typeof aPron === 'string') {
                      if (aPron.startsWith('{')) {
                          try {
                              const p = JSON.parse(aPron);
                              aDisplayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
                          } catch(e){}
                      } else if (aPron.startsWith('[')) {
                          try {
                              const p = JSON.parse(aPron);
                              aDisplayPron = p.map(c => c.trans || c.text).join('');
                          } catch(e){}
                      }
                  }
                  mapped.push({
                      ...adlib,
                      displayText: adlib.text,
                      translation: adlib.translation || '',
                      pronunciation: aPron,
                      displayPron: aDisplayPron,
                      _meta: { isAdlib: true, lineIndex: i, adlibIndex: j }
                  });
              });
          }
      });
      setWorkspaceData(mapped);
      setIsLoading(false);
    };
    initData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong?.trackId]);

  const fetchSingleLine = async (line) => {
    const textToTranslate = line.displayText.replace(/[()]/g, '').trim();
    if (!textToTranslate) return null;
    
    try {
      const resArr = await getBulkPronunciations([textToTranslate], null, true, true);
      return resArr?.[0] || null;
    } catch (e) {
      console.error("Single line fetch error:", e);
      return null;
    }
  };

  const handleTranslateAll = async () => {
     if (workspaceData.length === 0 || isTranslatingAll) return;
     
     setIsTranslatingAll(true);
     setShowSuccessBanner(false);
     setTranslateProgress({ current: 0, total: workspaceData.length });
     setNotification({ show: true, message: 'Starting Translation...', progress: 0 });
     
     let currentData = [...workspaceData];

     for (let i = 0; i < currentData.length; i++) {
         const line = currentData[i];
         setActiveTranslatingIndex(i);
         setTranslateProgress({ current: i + 1, total: currentData.length });

         const progressPct = Math.round(((i + 1) / currentData.length) * 100);
         setNotification({ 
           show: true, 
           message: `Translating line ${i + 1} of ${currentData.length}...`, 
           progress: progressPct 
         });

         const res = await fetchSingleLine(line);

         if (res) {
             let newTrans = res.translation !== undefined ? res.translation : line.translation;
             if (newTrans) newTrans = String(newTrans).replace(/[()]/g, '').trim();

             let displayPron = line.displayPron;
             if (res.pronunciation) {
                 try {
                     const p = JSON.parse(res.pronunciation);
                     displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
                 } catch(e) {}
             } else if (res.translation && !/[^\x00-\x7F]/.test(line.displayText)) {
                 displayPron = '';
             }

             currentData[i] = {
                 ...currentData[i],
                 translation: newTrans,
                 pronunciation: res.pronunciation || line.pronunciation,
                 displayPron: displayPron
             };

             setWorkspaceData([...currentData]);
         }

         await new Promise(r => setTimeout(r, 120));
     }
     
     setIsTranslatingAll(false);
     setActiveTranslatingIndex(-1);
     setShowSuccessBanner(true);
     setNotification({ show: true, message: 'All lines translated! Ready to Save.', progress: 100 });
     
     setTimeout(() => {
       setNotification({ show: false });
     }, 2000);

     setTimeout(() => {
       setShowSuccessBanner(false);
     }, 4000);
  };

  const handleRefetch = async (index) => {
     setActiveTranslatingIndex(index);
     setNotification({ show: true, message: `Translating line ${index + 1}...`, progress: null });
     const line = workspaceData[index];
     
     const res = await fetchSingleLine(line);
     if (res) {
         const newData = [...workspaceData];
         let newTrans = res.translation !== undefined ? res.translation : newData[index].translation;
         if (newTrans) newTrans = String(newTrans).replace(/[()]/g, '').trim();
         
         newData[index].translation = newTrans;
         newData[index].pronunciation = res.pronunciation || newData[index].pronunciation;
         
         if (res.pronunciation) {
             try {
                 const p = JSON.parse(res.pronunciation);
                 newData[index].displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
             } catch(e) {}
         } else {
             newData[index].displayPron = '';
         }
         setWorkspaceData(newData);
     }
     
     setActiveTranslatingIndex(-1);
     setNotification({ show: true, message: 'Line translated!', progress: 100 });
     setTimeout(() => setNotification({ show: false }), 1500);
  };

  const handleChange = (index, field, value) => {
     const newData = [...workspaceData];
     if (field === 'displayPron') {
         newData[index].displayPron = value;
         
         let currentPron = newData[index].pronunciation;
         if (currentPron && currentPron.startsWith('{')) {
             try {
                 let p = JSON.parse(currentPron);
                 p.full = value;
                 newData[index].pronunciation = JSON.stringify(p);
             } catch(e) {
                 newData[index].pronunciation = value;
             }
         } else {
             newData[index].pronunciation = value;
         }
     } else {
         newData[index][field] = value;
     }
     setWorkspaceData(newData);
  };

  const handleSave = () => {
     let sourceData = selectedSong.syncData || selectedSong.autoSyncData || [];
     const newSyncData = JSON.parse(JSON.stringify(sourceData));
     
     workspaceData.forEach(item => {
         const meta = item._meta;
         
         if (/[^\x00-\x7F]/.test(item.displayText) || item.translation) {
             forceSaveToCache(item.displayText, item.translation, item.pronunciation);
         }
         if (meta.isAdlib) {
             if (newSyncData[meta.lineIndex] && newSyncData[meta.lineIndex].adlibs) {
                 const target = newSyncData[meta.lineIndex].adlibs[meta.adlibIndex];
                 if (target) {
                     target.translation = item.translation;
                     target.pronunciation = item.pronunciation;
                 }
             }
         } else {
             const target = newSyncData[meta.lineIndex];
             if (target) {
                 target.translation = item.translation;
                 target.pronunciation = item.pronunciation;
             }
         }
     });

     updateSongInLibrary({
        ...selectedSong,
        syncData: newSyncData,
        autoSyncData: selectedSong.autoSyncData ? newSyncData : selectedSong.autoSyncData
     });
     
     setIsTranslationManagerOpen(false);
     setNotification({ show: true, message: 'Translations explicitly saved to memory!', progress: 100 });
     setTimeout(() => setNotification({ show: false }), 2000);
  };

  const handleExport = () => {
     const textContent = workspaceData.map(line => 
          `${line.displayText}\n${line.displayPron ? line.displayPron + '\n' : ''}${line.translation ? line.translation + '\n' : ''}`
     ).join('\n');
     const blob = new Blob([textContent], { type: 'text/plain' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${selectedSong.trackName}_Translation.txt`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="tw-container"><p>Loading workspace...</p></div>;

  return (
    <div className="tw-container">
       <div className="tw-header glass-panel">
           <div className="tw-header-titles">
               <h3 className="tw-title">Translation Workspace</h3>
               <p className="tw-subtitle">Edit translations and romanizations line by line.</p>
           </div>
           <div className="tw-header-actions">
               <button 
                 className={`tw-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`} 
                 onClick={handleTranslateAll}
                 disabled={isTranslatingAll}
               >
                 {isTranslatingAll ? (
                   <>
                     <span className="tw-spinner"></span>
                     <span>Translating ({translateProgress.current}/{translateProgress.total})...</span>
                   </>
                 ) : (
                   'Translate All'
                 )}
               </button>
               <button className="tw-btn" onClick={handleExport} disabled={isTranslatingAll}>Export Text</button>
               <button className="tw-btn tw-btn-cancel" onClick={() => setIsTranslationManagerOpen(false)} disabled={isTranslatingAll}>Cancel</button>
               <button className="tw-btn tw-btn-save" onClick={handleSave} disabled={isTranslatingAll}>Save Changes</button>
           </div>
       </div>

       {showSuccessBanner && (
         <div className="tw-success-banner">
            <span className="tw-success-icon">✓</span>
            <span>All lines translated successfully! Click <strong>Save Changes</strong> to apply to lyrics.</span>
         </div>
       )}
       
       <div className="tw-list glass-panel-light">
          {workspaceData.map((line, idx) => {
             const hasForeign = /[^\x00-\x7F]/.test(line.displayText);
             const isAdlib = line._meta.isAdlib;
             const isTranslating = activeTranslatingIndex === idx;
             
             return (
                 <div 
                   key={idx} 
                   className={`tw-row ${isAdlib ? 'tw-row-adlib' : ''} ${isTranslating ? 'tw-row-active' : ''}`}
                 >
                    <div className="tw-col tw-col-left">
                       <div className="tw-original-text" dir="auto">{line.displayText}</div>
                       {hasForeign ? (
                           <input
                               className="tw-input tw-translit-input"
                               value={line.displayPron || ''}
                               onChange={(e) => handleChange(idx, 'displayPron', e.target.value)}
                              placeholder="Transliteration..."
                              dir="ltr"
                           />
                       ) : (
                           <div className="tw-empty-subrow"></div>
                       )}
                    </div>
                    <div className="tw-col tw-col-right">
                       <textarea
                           className="tw-input tw-translation-input"
                           value={line.translation || ''}
                           onChange={(e) => handleChange(idx, 'translation', e.target.value)}
                          placeholder="English Translation..."
                          dir="ltr"
                       />
                    </div>
                    <div className="tw-col-actions">
                       <button 
                         className={`tw-refetch-btn ${isTranslating ? 'tw-refetch-active' : ''}`} 
                         onClick={() => handleRefetch(idx)} 
                         disabled={isTranslatingAll}
                         title="Re-fetch from Google Translate"
                       >
                           {isTranslating ? (
                             <span className="tw-spinner"></span>
                           ) : (
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                           )}
                       </button>
                    </div>
                 </div>
             );
          })}
       </div>
    </div>
  );
};

export default TranslationWorkspace;