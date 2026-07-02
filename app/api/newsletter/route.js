import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { meno, email, zdroj } = await req.json();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json({ error: 'Neplatný e-mail.' }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .upsert({ email: email.toLowerCase().trim(), meno, zdroj, gdpr_suhlas: true }, { onConflict: 'email' });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'Uloženie zlyhalo.' }, { status: 500 });
  }
}
