export const getDeezerApiUrl = (path) => {
  const relativePath = path.startsWith('/') ? path : `/${path}`;
  return `/api${relativePath}`;
};

export const fetchDeezerApi = async (path, options = {}) => {
  return fetch(getDeezerApiUrl(path), {
    ...options,
    credentials: 'same-origin'
  });
};