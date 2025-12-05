// Workspace Document API utility functions
// Use relative paths for proxying in development, absolute URL for production
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://aiva-backend-prod-app.azurewebsites.net/api'
  : '/api';

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

interface ExpiringDocument extends WorkspaceDocument {
  workspaceName: string;
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

// Create FormData for file uploads
const createDocumentFormData = (file: File, documentData: any) => {
  const formData = new FormData();
  formData.append('file', file);
  
  Object.keys(documentData).forEach(key => {
    if (documentData[key] !== undefined && documentData[key] !== null) {
      formData.append(key, documentData[key]);
    }
  });
  
  return formData;
};

// Workspace Document API functions
export const workspaceDocumentApi = {
  // Upload document to workspace (admin only)
  async uploadDocument(
    workspaceId: string,
    file: File,
    documentData: {
      name: string;
      type: 'legal' | 'default';
      startingDate?: string;
      endingDate?: string;
    }
  ): Promise<WorkspaceDocument> {
    try {
      const formData = createDocumentFormData(file, documentData);
      
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeaders().Authorization || '',
        },
        body: formData,
      });
      
      if (!response.ok) {
        handleAuthError(response);
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload document');
      }
      
      const data = await response.json();
      return data.document;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  // Get documents for workspace
  async getWorkspaceDocuments(workspaceId: string): Promise<WorkspaceDocument[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/documents`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to fetch workspace documents');
      }
      
      const data = await response.json();
      return data.documents || [];
    } catch (error) {
      console.error('Error fetching workspace documents:', error);
      throw error;
    }
  },

  // Delete document from workspace (admin only)
  async deleteDocument(workspaceId: string, documentId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/documents/${documentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  // Get expiring documents (for notification system)
  async getExpiringDocuments(): Promise<ExpiringDocument[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/documents/expiring`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error('Failed to fetch expiring documents');
      }
      
      const data = await response.json();
      return data.documents || [];
    } catch (error) {
      console.error('Error fetching expiring documents:', error);
      throw error;
    }
  },

  // Mark document notification as sent
  async markDocumentNotified(documentId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/documents/${documentId}/notify`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark document as notified');
      }
    } catch (error) {
      console.error('Error marking document as notified:', error);
      throw error;
    }
  },
};

export default workspaceDocumentApi;