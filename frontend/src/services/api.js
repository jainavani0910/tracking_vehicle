import axios from 'axios';
import { logger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Resilient API logging and retry wrappers
apiClient.interceptors.request.use((config) => {
  logger.info(`HTTP Request: ${config.method.toUpperCase()} ${config.url}`, config.params);
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    logger.info(`HTTP Response: ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    logger.error(`HTTP Request Failed: ${error.message} on ${error.config?.url}`, error.response?.data);
    return Promise.reject(error);
  }
);

export const vehicleAPI = {
  getVehiclesInBounds: (bounds) => {
    return apiClient.get('/api/vehicles/within', {
      params: {
        sw_lng: bounds.getSouthWest().lng,
        sw_lat: bounds.getSouthWest().lat,
        ne_lng: bounds.getNorthEast().lng,
        ne_lat: bounds.getNorthEast().lat,
      },
    });
  },
  getVehicle: (id) => apiClient.get(`/api/vehicles/${id}`),
  getVehicleHistory: (id) => apiClient.get(`/api/vehicles/${id}/history`),
};

export const healthCheck = () => apiClient.get('/health');

export default apiClient;
