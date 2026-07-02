'use client';
// ATESTIO · Admin: Prihlášky — potvrdenie úhrady a aktivácia prístupu
// (aktivácia stavu 'aktivna' automaticky vytvorí enrollment cez DB trigger)
import { useEffect, useState, useCallback } from 'react';
import { useAuth, LoginBox } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';

const DALSI = { nova: 'cakajuca_platba', cakajuca_platba: 'zaplatena', zaplatena: 'aktivna' };
const POPIS = { nova: 'Nová', cakajuca_platba: 'Čaká na úhradu', zaplatena: 'Uhradená', aktivna: 'Aktívna', zamietnuta: 'Zamietnutá' };
const AKCIA = { nova: 'Poslať na úhradu →', cakajuca_platba: 'Potvrdiť úhradu →', zaplatena: 'Aktivovať prístup →' };

export default function Prihlasky() {
  const user = useAuth();
  const [riadky, setRiadky] = useState([]);
  const [faktury, setFaktury] = useState({});
  const nacitaj = useCallback(async () => {
    const [{ data }, { data: fx }] = await Promise.all([
      supabase.from('prihlasky')
        .select('*, profiles(meno, priezvisko), courses(kod, nazov, cena_eur)')
        .order('created_at', { ascending: false }),
      supabase.from('faktury').select('*'),
    ]);
    setRiadky(data ?? []);
    setFaktury(Object.fromEntries((fx ?? []).map(x => [x.prihlaska_id, x])));
  }, []);
  useEffect(() => { if (user) nacitaj(); }, [user, nacitaj]);

  async function posun(p, novyStav) {
    await supabase.from('prihlasky').update({ stav: novyStav }).eq('id', p.id);
    nacitaj();
  }

  async function vystavProformu(p) {
    await supabase.from('faktury').insert({
      prihlaska_id: p.id,
      suma_eur: Number(p.courses?.cena_eur ?? 0),
      odberatel: p.skola || null,
    });
    if (p.stav === 'nova') await supabase.from('prihlasky').update({ stav: 'cakajuca_platba' }).eq('id', p.id);
    nacitaj();
  }

  async function uhradaPrijata(p) {
    const f = faktury[p.id];
    if (f) await supabase.from('faktury').update({ stav: 'uhradena' }).eq('id', f.id);
    await supabase.from('platby').insert({ prihlaska_id: p.id, zdroj: 'prevod', suma_eur: f ? Number(f.suma_eur) : null }).then(() => {});
    await supabase.from('prihlasky').update({ stav: 'zaplatena' }).eq('id', p.id);
    nacitaj();
  }

  if (user === undefined) return null;
  if (!user) return <LoginBox nadpis="Atestio · admin" />;

  return (
    <main style={{ maxWidth: 1000, margin: '30px auto', padding: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1>Prihlášky</h1>
        <a className="btn" href="/admin/obsah">Správa obsahu</a>
      </header>
      {riadky.map(p => (
        <div key={p.id} className="karta" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <b>{p.profiles?.meno ?? '—'} {p.profiles?.priezvisko ?? ''}</b> · {p.courses?.kod} — {p.courses?.nazov}
            <div style={{ fontSize: '.83rem', color: 'var(--siva)' }}>
              {p.skola || 'bez školy'} · platca: {p.platca} · riaditeľ: {p.potvrdenie_riaditela ? 'áno' : 'nie'} · {new Date(p.created_at).toLocaleDateString('sk')}
              {p.poznamka ? ` · ${p.poznamka}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: p.stav === 'aktivna' ? 'var(--smaragd)' : 'var(--slate)' }}>{POPIS[p.stav]}</span>
            {faktury[p.id]
              ? <a className="btn" href={`/faktura/${faktury[p.id].id}`}>Faktúra {faktury[p.id].cislo} ({faktury[p.id].stav})</a>
              : ['nova', 'cakajuca_platba'].includes(p.stav) &&
                <button className="btn" onClick={() => vystavProformu(p)}>Vystaviť proformu</button>}
            {p.stav === 'cakajuca_platba' &&
              <button className="btn btn-zeleny" onClick={() => uhradaPrijata(p)}>Úhrada prijatá (prevod) →</button>}
            {DALSI[p.stav] && p.stav !== 'cakajuca_platba' && <button className="btn btn-zeleny" onClick={() => posun(p, DALSI[p.stav])}>{AKCIA[p.stav]}</button>}
            {p.stav !== 'aktivna' && p.stav !== 'zamietnuta' &&
              <button className="btn" style={{ background: '#8A2B22' }} onClick={() => posun(p, 'zamietnuta')}>Zamietnuť</button>}
          </div>
        </div>
      ))}
      {riadky.length === 0 && <p style={{ color: 'var(--siva)' }}>Žiadne prihlášky.</p>}
    </main>
  );
}
