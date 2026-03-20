import axios from "axios";

export const api = axios.create({
  // In dev (no VITE_API_URL set), use "" so requests go to the same origin
  // as the frontend and Vite's proxy routes them to the backend.
  // This ensures HttpOnly cookies are same-origin and SameSite=Strict works.
  // In production, VITE_API_URL points to the deployed backend.
  baseURL: import.meta.env.VITE_API_URL ?? "",
  // Send the HttpOnly auth cookie with every cross-origin request.
  // The cookie is set server-side on login and cleared on logout —
  // JavaScript never reads or writes it, eliminating token theft via XSS.
  withCredentials: true,
});

// Central 401 handler: clear non-sensitive session state on token expiry.
// Cookies are cleared server-side via POST /users/logout.
// 403 (Forbidden) is NOT handled here — valid token, no permission.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = (error?.config?.url as string) || "";
    const status = error?.response?.status as number | undefined;

    // Do not force-redirect on auth endpoints so the login page can show errors
    const isAuthEndpoint =
      requestUrl.includes("/users/login") ||
      requestUrl.includes("/users/signup") ||
      requestUrl.includes("/users/select-studio") ||
      requestUrl.includes("/users/member-session") ||
      requestUrl.includes("/users/studios");

    if (status === 401 && !isAuthEndpoint) {
      try {
        sessionStorage.removeItem("studio_session");
        sessionStorage.removeItem("member_session");
        sessionStorage.removeItem("activeGame");
      } catch {
        // ignore storage errors in restricted environments
      }
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
