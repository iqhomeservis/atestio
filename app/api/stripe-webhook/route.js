import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Stripe webhook: po úspešnej platbe zapíše platbu a AKTIVUJE prihlášku
// (DB trigger následne vytvorí zápis do kurzu → prístup okamžite, bez admina).
export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('not configured', { status: 501 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const prihlaska_id = s.metadata?.prihlaska_id;
    if (prihlaska_id) {
      await supabaseAdmin.from('platby').insert({
        prihlaska_id, zdroj: 'stripe', stripe_id: s.id, suma_eur: (s.amount_total ?? 0) / 100,
      });
      await supabaseAdmin.from('prihlasky').update({ stav: 'aktivna' }).eq('id', prihlaska_id);
      await supabaseAdmin.from('audit_log').insert({
        akcia: 'platba_stripe', entita: 'prihlasky', entita_id: prihlaska_id,
        detail: { stripe_session: s.id, suma: (s.amount_total ?? 0) / 100 },
      });
    }
  }
  return new Response('ok');
}
