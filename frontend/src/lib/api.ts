import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// Optionally!  attached token automatically
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Central 401/403 handler: clear sessions and redirect to /login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error?.config?.url || "";
    const status = error?.response?.status;
    // Do not force-redirect on auth endpoints so the login page can show errors
    const isAuthEndpoint =
      requestUrl.includes("/users/login") ||
      requestUrl.includes("/users/signup") ||
      requestUrl.includes("/users/member-session") ||
      requestUrl.includes("/users/studios");

    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('studio_session');
        localStorage.removeItem('member_session');
        setAuthToken(null);
      } catch (e) {
        // ignore
      }
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

