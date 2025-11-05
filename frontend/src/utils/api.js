import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const deployToken = async (tokenData) => {
  const response = await api.post('/deploy', tokenData);
  return response.data;
};

export const getTokenInfo = async (address) => {
  const response = await api.get(`/tokens/${address}`);
  return response.data;
};

export const interactWithToken = async (interactionData) => {
  const response = await api.post('/interact', interactionData);
  return response.data;
};

export default api;
