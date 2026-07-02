'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Zdieľaný auth hook + jednoduché prihlásenie magic linkom
export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = načítava sa
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return user;
}

export function LoginBox({ nadpis = 'Prihlásenie' }) {
  const [email, setEmail] = useState('');
  const [odoslane, setOdoslane] = useState(false);
  const [chyba, setChyba] = useState('');
  async function submit(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    if (error) setChyba(error.message); else setOdoslane(true);
  }
  return (
    <main style={{ maxWidth: 420, margin: '80px auto', padding: 20 }}>
      <h1 style={{ marginBottom: 12 }}>{nadpis}</h1>
      {odoslane ? <p>Skontrolujte si e-mail — poslali sme vám prihlasovací odkaz.</p> : (
        <form onSubmit={submit} className="karta">
          <label htmlFor="em">E-mail</label>
          <input id="em" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <button className="btn btn-zeleny" style={{ marginTop: 14, width: '100%' }}>Poslať prihlasovací odkaz</button>
          {chyba && <p style={{ color: '#B00', marginTop: 8 }}>{chyba}</p>}
        </form>
      )}
    </main>
  );
}
