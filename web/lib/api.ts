import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || '/api';

export const apiClient = axios.create({
  baseURL: `${API_URL}${API_PREFIX}`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Project {
  id: string;
  name: string;
  iacType: 'terraform' | 'pulumi';
  lastScan?: Date;
  driftCount: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface ScanRequest {
  projectId: string;
  projectName: string;
  iacPath: string;
  iacType: 'terraform' | 'pulumi';
  configPath?: string;
  statePath?: string;
  stateBackend?: 's3' | 'azure' | 'gcs';
  stateBucket?: string;
  stateKey?: string;
}

export interface ScanResult {
  scanId: string;
  projectId: string;
  results: any[];
  summary: {
    total: number;
    drifted: number;
    healthy: number;
  };
}

export interface TrendData {
  timestamp: Date;
  driftCount: number;
  totalResources: number;
  criticalCount: number;
  highCount: number;
}

// API methods
export const api = {
  // Health
  health: () => apiClient.get('/health'),

  // Projects
  getProjects: () => apiClient.get<{ projects: Project[] }>('/projects'),
  getProject: (id: string) => apiClient.get<{ project: Project }>(`/projects/${id}`),
  createProject: (project: Omit<Project, 'driftCount' | 'status'>) =>
    apiClient.post<{ project: Project }>('/projects', project),
  deleteProject: (id: string) => apiClient.delete(`/projects/${id}`),

  // Scanning
  scan: (request: ScanRequest) => apiClient.post<ScanResult>('/scan', request),
  getScan: (scanId: string) => apiClient.get(`/scan/${scanId}`),
  getScans: (limit?: number) => apiClient.get('/scans', { params: { limit } }),

  // History
  getHistory: (projectId: string, limit?: number) =>
    apiClient.get(`/history/${projectId}`, { params: { limit } }),
  getStats: (projectId: string) => apiClient.get(`/history/${projectId}/stats`),
  getTrends: (projectId: string, days?: number) =>
    apiClient.get<{ trends: TrendData[] }>(`/history/${projectId}/trends`, { params: { days } }),

  // Resources
  getResources: (projectId: string) => apiClient.get(`/resources/${projectId}`),
  getResource: (projectId: string, resourceId: string) =>
    apiClient.get(`/resources/${projectId}/${resourceId}`),
};
