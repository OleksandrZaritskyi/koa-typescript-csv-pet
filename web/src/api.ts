import { Job } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

export async function uploadCsv(file: File): Promise<{ jobId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/jobs/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${API_BASE}/jobs`);
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
}

export async function fetchJob(id: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${id}`);
  if (!res.ok) throw new Error('Failed to fetch job');
  return res.json();
}

export function subscribeToJob(id: string, onMessage: (data: Partial<Job>) => void): EventSource {
  const es = new EventSource(`${API_BASE}/jobs/${id}/stream`);
  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error('SSE parse error', err);
    }
  };
  return es;
}
