const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(cors());

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(Webhook Error: ${err.message});
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;
    const sessionId = session.id;
    const token = crypto.randomBytes(32).toString('hex');
    await supabase.from('purchases').insert([{ email, token, stripe_session_id: sessionId }]);
    console.log(Purchase saved for ${email});
  }
  res.json({ received: true });
});

app.get('/verify/:token', express.json(), async (req, res) => {
  const { token } = req.params;
  const { data, error } = await supabase.from('purchases').select('email').eq('token', token).single();
  if (error || !data) return res.status(404).json({ valid: false });
  res.json({ valid: true, email: data.email });
});

app.get('/', (req, res) => res.json({ status: 'Self-Care Server running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(Server running on port ${PORT}));
