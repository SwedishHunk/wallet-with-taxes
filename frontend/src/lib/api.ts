import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
});

// Optionally!  attached token automatically
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

// Central 401 handler: clear sessions on token expiry / invalid token.
// 403 (Forbidden) is NOT handled here — it means the token is valid but the
// user lacks permission for that resource, so we must not wipe their session.
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

    if (status === 401 && !isAuthEndpoint) {
      try {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("studio_session");
        sessionStorage.removeItem("member_session");
        sessionStorage.removeItem("activeGame");
        localStorage.removeItem("token");
        localStorage.removeItem("studio_session");
        localStorage.removeItem("member_session");
        setAuthToken(null);
      } catch {
        // ignore
      }
      // Redirect to login so React state is also reset (avoids half-logged-in state)
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
