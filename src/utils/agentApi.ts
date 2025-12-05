// API base URL configuration - matches api.ts pattern
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://aiva-backend-prod-app.azurewebsites.net/api'
  : '/api';

export interface AgentAuthStatus {
  authenticated: boolean;
  threadId?: string;
  agentInitialized: boolean;
}

export interface AgentLoginResponse {
  authenticated: boolean;
  threadId: string;
  message: string;
}

export interface AgentMessageResponse {
  response: string;
  threadId: string;
  status: string;
}

class AgentAPI {
  private static instance: AgentAPI;

  private constructor() {}

  public static getInstance(): AgentAPI {
    if (!AgentAPI.instance) {
      AgentAPI.instance = new AgentAPI();
    }
    return AgentAPI.instance;
  }

  /**
   * Check agent authentication status
   */
  async checkAuthStatus(): Promise<AgentAuthStatus> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/agent/auth/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to check agent authentication status');
    }

    return await response.json();
  }

  /**
   * Login with Microsoft for Azure AI Agent
   */
  async login(): Promise<AgentLoginResponse> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/agent/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to login with Microsoft');
    }

    return await response.json();
  }

  /**
   * Logout from Azure AI Agent
   */
  async logout(): Promise<void> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/agent/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to logout');
    }
  }

  /**
   * Send a message to the Azure AI Agent
   */
  async sendMessage(message: string, threadId?: string): Promise<AgentMessageResponse> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/agent/chat/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        threadId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Check if requires agent authentication
      if (error.requiresAgentAuth) {
        const authError = new Error(error.message || 'Agent authentication required');
        (authError as any).requiresAgentAuth = true;
        throw authError;
      }
      
      throw new Error(error.message || 'Failed to send message to agent');
    }

    return await response.json();
  }

  /**
   * Get the current thread ID
   */
  async getThreadId(): Promise<{ threadId?: string; initialized: boolean }> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/agent/chat/thread`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get thread information');
    }

    return await response.json();
  }
}

export const agentAPI = AgentAPI.getInstance();
