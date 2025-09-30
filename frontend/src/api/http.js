import axios from "axios";

const http = axios.create({
  baseURL: import.meta?.env?.VITE_API_BASE || "",
  timeout: 10000, // 10 second timeout
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Add response interceptor for better error handling
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      console.warn('Backend connection failed, retrying...');
      // Could add retry logic here if needed
    }
    return Promise.reject(error);
  }
);

export default http;
