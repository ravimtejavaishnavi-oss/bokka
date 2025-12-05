import axios from 'axios';

const API_BASE_URL = import.meta.env.PROD 
  ? 'https://aiva-backend-prod-app.azurewebsites.net/api'
  : '/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Retrieve a specific message by ID with full context
 * Used when navigating from history/bookmarks/liked/disliked to a specific message
 */
export async function getMessageById(messageId: string) {
  try {
    const response = await apiClient.get(`/messages/${messageId}`);
    return response.data.data;
  } catch (error: any) {
    console.error('Error retrieving message:', error);
    throw error;
  }
}

/**
 * Get minimal context for a message (surrounding messages)
 */
export async function getMessageContext(messageId: string, contextSize: number = 5) {
  try {
    const response = await apiClient.get(`/messages/${messageId}/context`, {
      params: { contextSize }
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error retrieving message context:', error);
    throw error;
  }
}

export const messageRetrievalAPI = {
  getMessageById,
  getMessageContext
};
