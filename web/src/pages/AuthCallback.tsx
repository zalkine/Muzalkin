import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * OAuth callback page.
 * Supabase's detectSessionInUrl:true handles the token exchange automatically.
 * We just wait for the auth state to update, then redirect.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const returnTo = sessionStorage.getItem('auth_return') ?? '/search';
        sessionStorage.removeItem('auth_return');
        navigate(returnTo, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: '#888',
      fontSize: 16,
    }}>
      מתחבר…
    </div>
  );
}
