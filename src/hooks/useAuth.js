import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook to track Supabase auth session state and user role
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      } else {
        // Default to admin for main auth user if no profile row exists
        setProfile({ role: 'admin', is_active: true, full_name: 'Main Admin' });
      }
    } catch {
      setProfile({ role: 'admin', is_active: true });
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const user = session?.user ?? null;
  const role = profile?.role ?? 'admin';
  const isActive = profile?.is_active ?? true;

  return {
    session,
    loading,
    signOut,
    user,
    profile,
    role,
    isActive,
    isAdmin: role === 'admin',
    isCoordinator: role === 'coordinator',
  };
}
