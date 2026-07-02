'use client';
// ATESTIO · Zálohová faktúra (proforma) — tlačiteľné zobrazenie (Ctrl+P → PDF)
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth, LoginBox } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';

const DODAVATEL = {
  nazov: '[DOPLNIŤ: obchodné meno s.r.o.]',
  adresa: '[DOPLNIŤ: sídlo]',
  ico: '[IČO]', dic: '[DIČ]',
  iban: '[DOPLNIŤ: IBAN]',
  poznamka: 'Zálohová faktúra — nie je daňový doklad. Daňový doklad (faktúru) vystavíme po prijatí úhrady.',
};

export default function Faktura() {
  const { id } = useParams();
  const user = useAuth();
  const [f, setF] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('faktury')
      .select('*, prihlasky(skola, platca, poznamka, profiles(meno, priezvisko, titul), courses(kod, nazov, rozsah_hodin))')
      .eq('id', id).single().then(({ data }) => setF(data));
  }, [user, id]);

  if (user === undefined) return null;
  if (!user) return <LoginBox nadpis="Atestio · faktúra" />;
  if (!f) return null;

  const p = f.prihlasky;
  const meno = [p?.profiles?.titul, p?.profiles?.meno, p?.profiles?.priezvisko].filter(Boolean).join(' ');

  return (
    <main style={{ maxWidth: 760, margin: '30px auto', padding: 24, background: '#fff', border: '1px solid var(--linka)', borderRadius: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Zálohová faktúra č. {f.cislo}</h1>
        <button className="btn no-print" onClick={() => window.print()}>Tlačiť / PDF</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '22px 0' }}>
        <div>
          <b>Dodávateľ</b>
          <p>{DODAVATEL.nazov}<br />{DODAVATEL.adresa}<br />IČO: {DODAVATEL.ico} · DIČ: {DODAVATEL.dic}</p>
        </div>
        <div>
          <b>Odberateľ</b>
          <p>{f.odberatel || p?.skola || meno}<br />Účastník: {meno}</p>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead><tr style={{ background: 'var(--papier)' }}>
          <th style={{ textAlign: 'left', padding: 8, border: '1px solid var(--linka)' }}>Položka</th>
          <th style={{ textAlign: 'right', padding: 8, border: '1px solid var(--linka)' }}>Suma</th>
        </tr></thead>
        <tbody><tr>
          <td style={{ padding: 8, border: '1px solid var(--linka)' }}>
            {p?.courses?.kod} — {p?.courses?.nazov} (rozsah {p?.courses?.rozsah_hodin} h)
          </td>
          <td style={{ padding: 8, border: '1px solid var(--linka)', textAlign: 'right' }}>{Number(f.suma_eur).toFixed(2)} €</td>
        </tr></tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <b>Platobné údaje</b>
          <p>IBAN: {DODAVATEL.iban}<br />Variabilný symbol: <b>{f.vs}</b><br />Splatnosť: {new Date(f.splatnost).toLocaleDateString('sk')}</p>
        </div>
        <div style={{ textAlign: 'right', alignSelf: 'end' }}>
          <p style={{ fontSize: '1.2rem' }}>Spolu na úhradu: <b>{Number(f.suma_eur).toFixed(2)} €</b></p>
        </div>
      </div>

      <p style={{ marginTop: 22, fontSize: '.8rem', color: 'var(--siva)' }}>{DODAVATEL.poznamka}</p>
      <style jsx global>{`@media print { .no-print { display: none } body { background: #fff } main { border: none } }`}</style>
    </main>
  );
}
