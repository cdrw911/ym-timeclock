import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Personal page API (token-based auth)
export const personalApi = {
  getTodaySummary: (code: string, token: string) =>
    api.get(`/api/public/user/${code}/summary?token=${token}`),

  clockIn: (code: string, token: string, type: 'onsite' | 'remote') =>
    api.post(`/api/clock/in`, { type }, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code },
    }),

  clockOut: (code: string, token: string) =>
    api.post(`/api/clock/out`, {}, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code },
    }),

  breakStart: (code: string, token: string) =>
    api.post(`/api/clock/break-start`, {}, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code },
    }),

  breakEnd: (code: string, token: string) =>
    api.post(`/api/clock/break-end`, {}, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code },
    }),

  getDaySummary: (code: string, token: string, date: string) =>
    api.get(`/api/me/day-summary`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code, date },
    }),

  getMonthSummary: (code: string, token: string, month: string) =>
    api.get(`/api/me/month-summary`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code, month },
    }),

  getScore: (code: string, token: string, month: string) =>
    api.get(`/api/me/score`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code, month },
    }),

  submitAdvanceNotice: (code: string, token: string, data: {
    type: 'late' | 'leave';
    date: string;
    expected_minutes?: number;
    reason: string;
  }) =>
    api.post(`/api/advance-notice`, data, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code },
    }),

  submitLeaveRequest: (code: string, token: string, data: {
    start_datetime: string;
    end_datetime: string;
    type: 'sick' | 'menstrual' | 'personal' | 'other';
    reason: string;
  }) =>
    api.post(`/api/leave`, data, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code },
    }),

  submitRetroClockRequest: (code: string, token: string, data: {
    date: string;
    time: string;
    type: string;
    reason: string;
    improvement_plan: string;
  }) =>
    api.post(`/api/retro-clock`, data, {
      headers: { Authorization: `Bearer ${token}` },
      params: { code },
    }),
};

// Admin API (JWT-based auth)
export const adminApi = {
  setAuthToken: (token: string) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },

  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),

  // Users
  getUsers: () => api.get('/api/admin/users'),
  getUserById: (id: string) => api.get(`/api/admin/users/${id}`),
  resetUserToken: (id: string) => api.post(`/api/admin/users/${id}/reset-token`),

  // Attendance
  getAttendance: (params: { user_id?: string; date_range?: string }) =>
    api.get('/api/admin/attendance', { params }),
  getDaySummary: (params: { user_id: string; date: string }) =>
    api.get('/api/admin/day-summary', { params }),

  // Leave requests
  getLeaveRequests: (status?: string) =>
    api.get('/api/admin/leave-requests', { params: { status } }),
  approveLeaveRequest: (id: string, notes?: string) =>
    api.post(`/api/admin/leave-requests/${id}/approve`, { notes }),
  rejectLeaveRequest: (id: string, notes: string) =>
    api.post(`/api/admin/leave-requests/${id}/reject`, { notes }),

  // Retro clock requests
  getRetroRequests: (status?: string) =>
    api.get('/api/admin/retro-requests', { params: { status } }),
  approveRetroRequest: (id: string, notes?: string) =>
    api.post(`/api/admin/retro-requests/${id}/approve`, { notes }),
  rejectRetroRequest: (id: string, notes: string) =>
    api.post(`/api/admin/retro-requests/${id}/reject`, { notes }),

  // Schedule
  createSchedule: (data: any) => api.post('/api/admin/schedule', data),
  getSchedule: (userId: string) => api.get(`/api/admin/schedule/${userId}`),
  confirmSchedule: (id: string) => api.post(`/api/admin/schedule/${id}/confirm`),

  // Scores
  getScores: (month: string) => api.get('/api/admin/scores', { params: { month } }),
  exportReport: (month: string, format: 'csv' | 'excel') =>
    api.get('/api/admin/report/export', {
      params: { month, format },
      responseType: 'blob',
    }),

  // System config
  getConfig: () => api.get('/api/admin/config'),
  updateConfig: (key: string, value: any) =>
    api.put(`/api/admin/config/${key}`, { value }),
};

// Public API
export const publicApi = {
  getBoard: () => api.get('/api/public/board'),
};
