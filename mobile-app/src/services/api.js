import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = process.env.EXPO_PUBLIC_API_PORT?.trim() || "8070";

const getHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;

  return hostUri?.split(":")[0] || null;
};

const addUrl = (urls, value) => {
  if (value && !urls.includes(value)) {
    urls.push(value);
  }
};

const getBaseUrls = () => {
  const urls = [];
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (configuredUrl) {
    addUrl(urls, configuredUrl);
  }

  const host = getHost();

  if (host) {
    addUrl(urls, `http://${host}:${DEFAULT_PORT}`);
  }

  if (Platform.OS === "ios") {
    addUrl(urls, `http://localhost:${DEFAULT_PORT}`);
    addUrl(urls, `http://127.0.0.1:${DEFAULT_PORT}`);
  }

  if (Platform.OS === "android") {
    addUrl(urls, `http://10.0.2.2:${DEFAULT_PORT}`);
  }

  addUrl(urls, `http://localhost:${DEFAULT_PORT}`);
  addUrl(urls, `http://127.0.0.1:${DEFAULT_PORT}`);

  return urls;
};

const baseUrls = getBaseUrls();

const api = axios.create({
  baseURL: baseUrls[0],
  timeout: 5000, // Reduced timeout for better mobile UX
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If we have a response, it's an HTTP error (4xx/5xx), don't retry
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.data?.error || error.message;

      // Enhance error messages for common cases
      if (status === 401) {
        error.message = "Session expired. Please log in again.";
      } else if (status === 403) {
        error.message = "You don't have permission to perform this action.";
      } else if (status === 404) {
        error.message = "The requested resource was not found.";
      } else if (status === 500) {
        error.message = "Server error. Please try again later.";
      } else if (status >= 400 && status < 500) {
        error.message = message || "Request failed. Please check your input.";
      } else if (status >= 500) {
        error.message = "Server is temporarily unavailable. Please try again later.";
      }

      throw error;
    }

    // Network error - try to retry with different base URL
    if (!originalRequest) {
      throw error;
    }

    const currentIndex = originalRequest.__baseUrlIndex ?? 0;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= baseUrls.length) {
      error.message = "Unable to connect to server. Please check your internet connection.";
      throw error;
    }

    originalRequest.__baseUrlIndex = nextIndex;
    originalRequest.baseURL = baseUrls[nextIndex];

    return api.request(originalRequest);
  }
);

export default api;
