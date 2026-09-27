export const getDeezerApiUrl = (path) => {
  const relativePath = path.startsWith('/') ? path : `/${path}`;
  return `/api${relativePath}`;
};

export const fetchDeezerApi = async (path, options = {}) => {
  const response = await fetch(getDeezerApiUrl(path), {
    ...options,
    credentials: 'same-origin'
  });

  if (response.ok && response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    throw new Error('The Deezer API route is unavailable. Please retry in a moment.');
  }

  return response;
};