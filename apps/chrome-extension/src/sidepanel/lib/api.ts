/**
 * Typed API client for the Brage AI Hub backend.
 * All requests go to VITE_HUB_URL (e.g. http://localhost:3001).
 */

import type { Meeting, UtterancePayload } from '../../types'

const HUB = (import.meta.env.VITE_HUB_URL as string) || 'http://localhost:3001'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${HUB}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${HUB}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json()
}

export interface Employee {
  id: string
  name: string
  description: string
  initials: string
}

export const api = {
  meetings: {
    list: (status?: string) =>
      get<Meeting[]>(`/api/meetings${status ? `?status=${status}` : ''}`),

    get: (id: string) => get<Meeting>(`/api/meetings/${id}`),

    create: (body: {
      title: string
      description?: string
      scheduled_at?: string
      agenda?: { sequence: number; text: string }[]
    }) => post<Meeting>('/api/meetings', body),

    addParticipant: (id: string, participant_type: 'agent' | 'employee', participant_id: string) =>
      post<unknown>(`/api/meetings/${id}/participants`, { participant_type, participant_id }),

    start: (id: string) => post<{ status: string }>(`/api/meetings/${id}/start`),

    end: (id: string) => post<{ status: string }>(`/api/meetings/${id}/end`),

    utterance: (id: string, payload: UtterancePayload) =>
      post<{ status: string }>(`/api/meetings/${id}/utterance`, payload),

    chat: (id: string, message: string) =>
      post<{ status: string }>(`/api/meetings/${id}/chat`, { message }),

    sonioxConfig: () =>
      get<{ api_key: string }>('/api/meetings/soniox-config'),
  },

  employees: {
    list: () => get<Employee[]>('/api/employees'),
  },
}
