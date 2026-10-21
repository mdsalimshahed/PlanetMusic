const getLanguageName = language => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' })
      .of(language.split('-')[0]) || language;
  } catch {
    return language;
  }
};

export const getDetectedForeignLanguageNames = workspaceData => (
  [...new Set(workspaceData.map(line => line.lang))]
    .filter(language => language && language !== 'auto' && language !== 'en')
    .map(getLanguageName)
);
