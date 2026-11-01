let songModalModulePromise;

export const loadSongModal = () => {
  if (!songModalModulePromise) {
    songModalModulePromise = import('./SongModal.jsx').catch(error => {
      songModalModulePromise = null;
      throw error;
    });
  }
  return songModalModulePromise;
};
