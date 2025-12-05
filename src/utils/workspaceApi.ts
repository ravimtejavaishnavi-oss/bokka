// Workspace API utility functions
// Use relative paths for proxying in development, absolute URL for production
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://aiva-backend-prod-app.azurewebsites.net/api'
  : '/api';

interface Workspace {
  id: string;
  name: string;
  description: string;
  color: string;
  isShared: boolean;
  ownerId: string;
  chatCount: number;
  lastActivity: string;
  createdAt: string;
}

interface WorkspaceFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

interface WorkspaceDocument {
  id: string;
  name: string;
  type: 'legal' | 'default';
  workspaceId: string;
  userId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  startingDate?: string;
  endingDate?: string;
  isNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  isAssigned: boolean;
  accessLevel?: string;
  assignedAt?: string;
}

interface ApiResponse<T> {
  message: string;
  data?: T;
  error?: string;
}

// Get authentication headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

// Handle 401 Unauthorized errors
const handleAuthError = (response: Response) => {
  if (response.status === 401) {
    console.warn('Authentication failed - clearing session and redirecting to login');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('adminAuthenticated');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/admin/login') {
      window.location.href = '/login';
    }
    throw new Error('Please login again');
  }
};

// Workspace API functions
export const workspaceAPI = {
  // Get all workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to fetch workspaces');
      }
      
      const data = await response.json();
      return data.workspaces || [];
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      throw error;
    }
  },

  // Create new workspace (admin only)
  async createWorkspace(workspace: {
    name: string;
    description: string;
    color: string;
    isShared: boolean;
  }): Promise<Workspace> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(workspace),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to create workspace');
      }
      
      const data = await response.json();
      return data.workspace;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  },

  // Update workspace (admin only)
  async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to update workspace');
      }
      
      const data = await response.json();
      return data.workspace;
    } catch (error) {
      console.error('Error updating workspace:', error);
      throw error;
    }
  },

  // Delete workspace (admin only)
  async deleteWorkspace(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to delete workspace');
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      throw error;
    }
  },

  // Get available users for workspace assignment (admin only)
  async getAvailableUsers(workspaceId: string, search?: string): Promise<User[]> {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/available-users?${params}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to fetch available users');
      }
      
      const data = await response.json();
      return data.users || [];
    } catch (error) {
      console.error('Error fetching available users:', error);
      throw error;
    }
  },

  // Assign users to workspace (admin only)
  async assignUsers(workspaceId: string, userIds: string[], accessLevel = 'member'): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/assign-user`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userIds, accessLevel }),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to assign users');
      }
    } catch (error) {
      console.error('Error assigning users:', error);
      throw error;
    }
  },

  // Remove users from workspace (admin only)
  async removeUsers(workspaceId: string, userIds: string[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/remove-user`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userIds }),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to remove users');
      }
    } catch (error) {
      console.error('Error removing users:', error);
      throw error;
    }
  },

  // Update user access level in workspace (admin only)
  async updateUserAccess(workspaceId: string, userId: string, accessLevel: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/user-access`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, accessLevel }),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to update user access');
      }
    } catch (error) {
      console.error('Error updating user access:', error);
      throw error;
    }
  },

  // Upload file to workspace
  async uploadFileToWorkspace(workspaceId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/upload`, {
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {},
        body: formData,
      });
      
      if (!response.ok) {
        let errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        try {
          errorData = await response.json();
        } catch (e) {
          // ignore JSON parse error
        }
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).details = errorData;
        throw error;
      }
      
      return response.json();
    } catch (err) {
      console.error('File Upload Request Failed:', `/workspaces/${workspaceId}/upload`, err);
      throw err;
    }
  },
  
  // Upload document to workspace
  async uploadDocumentToWorkspace(workspaceId: string, file: File, documentData: {
    name: string;
    type: 'legal' | 'default';
    startingDate?: string;
    endingDate?: string;
  }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', documentData.name);
    formData.append('type', documentData.type);
    if (documentData.startingDate) {
      formData.append('startingDate', documentData.startingDate);
    }
    if (documentData.endingDate) {
      formData.append('endingDate', documentData.endingDate);
    }
    
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/documents`, {
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {},
        body: formData,
      });
      
      if (!response.ok) {
        let errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        try {
          errorData = await response.json();
        } catch (e) {
          // ignore JSON parse error
        }
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).details = errorData;
        throw error;
      }
      
      return response.json();
    } catch (err) {
      console.error('Document Upload Request Failed:', `/workspaces/${workspaceId}/documents`, err);
      throw err;
    }
  },
  
  // Trigger workspace indexing
  async triggerWorkspaceIndexing(workspaceId: string) {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/index`, {
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        let errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        try {
          errorData = await response.json();
        } catch (e) {
          // ignore JSON parse error
        }
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).details = errorData;
        throw error;
      }
      
      return response.json();
    } catch (err) {
      console.error('Workspace Indexing Request Failed:', `/workspaces/${workspaceId}/index`, err);
      throw err;
    }
  },
  
  // Get files for workspace
  async getWorkspaceFiles(workspaceId: string): Promise<{files: WorkspaceFile[]}> {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/files`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        let errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        try {
          errorData = await response.json();
        } catch (e) {
          // ignore JSON parse error
        }
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).details = errorData;
        throw error;
      }
      
      return response.json();
    } catch (err) {
      console.error('Get Workspace Files Request Failed:', `/workspaces/${workspaceId}/files`, err);
      throw err;
    }
  },
  
  // Get documents for workspace
  async getWorkspaceDocuments(workspaceId: string): Promise<{documents: WorkspaceDocument[]}> {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/documents`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        let errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        try {
          errorData = await response.json();
        } catch (e) {
          // ignore JSON parse error
        }
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).details = errorData;
        throw error;
      }
      
      return response.json();
    } catch (err) {
      console.error('Get Workspace Documents Request Failed:', `/workspaces/${workspaceId}/documents`, err);
      throw err;
    }
  },
  
  // Delete file from workspace
  async deleteWorkspaceFile(workspaceId: string, fileId: string) {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/files/${fileId}`, {
        method: 'DELETE',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        let errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        try {
          errorData = await response.json();
        } catch (e) {
          // ignore JSON parse error
        }
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).details = errorData;
        throw error;
      }
      
      return response.json();
    } catch (err) {
      console.error('Delete Workspace File Request Failed:', `/workspaces/${workspaceId}/files/${fileId}`, err);
      throw err;
    }
  },
  
  // Delete document from workspace
  async deleteWorkspaceDocument(workspaceId: string, documentId: string) {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/documents/${documentId}`, {
        method: 'DELETE',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        let errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        try {
          errorData = await response.json();
        } catch (e) {
          // ignore JSON parse error
        }
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).details = errorData;
        throw error;
      }
      
      return response.json();
    } catch (err) {
      console.error('Delete Workspace Document Request Failed:', `/workspaces/${workspaceId}/documents/${documentId}`, err);
      throw err;
    }
  }
};

export default workspaceAPI;