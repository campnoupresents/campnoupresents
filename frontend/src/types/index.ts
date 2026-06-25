export interface Team {
  _id?: string;
  name: string;
  manager?: string;
  members?: Player[];
  group?: string;
}

export interface Player {
  _id?: string;
  name: string;
  goals: number;
  position?: string;
  assists?: number;
  jerseyNumber?: number;
}

export interface Match {
  _id?: string;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  date?: string;
  status: 'Upcoming' | 'Finished';
  group?: string;
}

export interface Tournament {
  _id?: string;
  type: 'League' | 'Group Stage';
  groups?: Record<string, string[]>;
  startDate?: string;
  endDate?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface Scorer {
  name: string;
  team: string;
  goals: number;
}
