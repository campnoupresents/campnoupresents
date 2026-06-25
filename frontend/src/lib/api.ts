import type { AuthResponse, Team, Match, Tournament } from '../types';

const API_BASE_URL = 'http://localhost:4000/api';
const TOKEN_KEY = 'authToken';

// Token management
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Generic API fetch wrapper
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API Error');
  }

  return response.json();
}

// Auth API
export const authAPI = {
  login: (email: string, password: string): Promise<AuthResponse> =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => {
    removeToken();
  },
};

// Teams API
export const teamsAPI = {
  getAll: (): Promise<Team[]> => apiFetch('/teams'),

  getById: (id: string): Promise<Team> => apiFetch(`/teams/${id}`),

  create: (team: Team): Promise<Team> =>
    apiFetch('/teams', {
      method: 'POST',
      body: JSON.stringify(team),
    }),

  update: (id: string, team: Team): Promise<Team> =>
    apiFetch(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(team),
    }),

  delete: (id: string): Promise<void> =>
    apiFetch(`/teams/${id}`, { method: 'DELETE' }),

  addMember: (teamId: string, member: any): Promise<Team> =>
    apiFetch(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(member),
    }),
};

// Matches API
export const matchesAPI = {
  getAll: (): Promise<Match[]> => apiFetch('/matches'),

  getById: (id: string): Promise<Match> => apiFetch(`/matches/${id}`),

  create: (match: Match): Promise<Match> =>
    apiFetch('/matches', {
      method: 'POST',
      body: JSON.stringify(match),
    }),

  update: (id: string, match: Match): Promise<Match> =>
    apiFetch(`/matches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(match),
    }),

  delete: (id: string): Promise<void> =>
    apiFetch(`/matches/${id}`, { method: 'DELETE' }),
};

// Tournaments API
export const tournamentsAPI = {
  get: (): Promise<Tournament> => apiFetch('/tournaments'),

  update: (tournament: Tournament): Promise<Tournament> =>
    apiFetch('/tournaments', {
      method: 'PUT',
      body: JSON.stringify(tournament),
    }),
};
