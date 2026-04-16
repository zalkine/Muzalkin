import type { User } from './types';

interface HeaderProps {
  user: User | null;
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="px-5 pt-12 pb-2">
      <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1 }}>
        {user?.isAuthenticated ? `Hi ${user.firstName} 👋` : 'Hi there 👋'}
      </h1>
      <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', margin: '6px 0 0', fontWeight: 400 }}>
        What do you want to play today?
      </p>
    </header>
  );
}
