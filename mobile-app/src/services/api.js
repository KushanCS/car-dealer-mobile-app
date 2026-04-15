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
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest || error.response) {
      throw error;
    }

    const currentIndex = originalRequest.__baseUrlIndex ?? 0;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= baseUrls.length) {
      throw error;
    }

    originalRequest.__baseUrlIndex = nextIndex;
    originalRequest.baseURL = baseUrls[nextIndex];

    return api.request(originalRequest);
  }
);

export default api;
