import axios from "axios";

const baseURL = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL;

if (!baseURL) {
  throw new Error("REACT_APP_BACKEND_URL is required");
}

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

export const authConfig = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
