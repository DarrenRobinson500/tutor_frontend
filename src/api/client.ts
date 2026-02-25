import axios from "axios"

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || "http://localhost:8000",
});

api.interceptors.requst.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = 'Bearer ${token}';
  }
  return config;
});

export default api;