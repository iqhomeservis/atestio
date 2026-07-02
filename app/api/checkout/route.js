import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Vytvorí Stripe Checkout session pre prihlášku (platba kartou).
export async function POST(req) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: 'Platby kartou zatiaľ nie sú aktivované — použite úhradu faktúrou.' }, { status: 501 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return Response.json({ error: 'Neprihlásený používateľ.' }, { status: 401 });

    const { prihlaska_id } = await req.json();
    const { data: p } = await supabaseAdmin
      .from('prihlasky').select('*, courses(kod, nazov, cena_eur)')
      .eq('id', prihlaska_id).single();
    if (!p || p.user_id !== user.id) return Response.json({ error: 'Prihláška nenájdená.' }, { status: 404 });
    if (!['nova', 'cakajuca_platba'].includes(p.stav)) return Response.json({ error: 'Prihláška už je vybavená.' }, { status: 400 });

    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(Number(p.courses.cena_eur) * 100),
          product_data: { name: `${p.courses.kod} — ${p.courses.nazov}` },
        },
      }],
      metadata: { prihlaska_id },
      customer_email: user.email,
      success_url: `${base}/moje?platba=ok`,
      cancel_url: `${base}/moje?platba=zrusena`,
    });

    await supabaseAdmin.from('prihlasky')
      .update({ stripe_session_id: session.id, stav: 'cakajuca_platba' })
      .eq('id', prihlaska_id);

    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: 'Platbu sa nepodarilo pripraviť.' }, { status: 500 });
  }
}
