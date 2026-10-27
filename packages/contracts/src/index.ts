export type TaskStatus = 'queued' | 'submitting' | 'running' | 'succeeded' | 'failed' | 'unknown';

export interface ImageTask {
  id: string;
  status: TaskStatus;
  created_at: string;
}

export interface ServiceStatus {
  generationEnabled: false;
  authenticationConfigured: boolean;
}
