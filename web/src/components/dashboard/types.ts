export type User = {
  firstName: string;
  isAuthenticated: boolean;
};

export type JamSession = {
  active: boolean;
  code: string;
  currentSong: string;
  participants: number;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  source: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
};
