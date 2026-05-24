// ════════════════════════════════════════════════════════════════════════
// API endpoint: /api/stripe
// Maneja:
//   - type: "create-checkout"  → crea una Checkout Session y devuelve la URL
//   - type: "verify-session"   → verifica que un session_id está pagado
// ════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY no configurada en el servidor' });
  }

  try {
    const { type, payload } = req.body;

    if (type === 'create-checkout') {
      const result = await createCheckoutSession(secretKey, payload);
      return res.status(200).json({ success: true, data: result });
    }

    if (type === 'verify-session') {
      const result = await verifySession(secretKey, payload);
      return res.status(200).json({ success: true, data: result });
    }

    return res.status(400).json({ error: 'Tipo de petición no reconocido' });

  } catch (err) {
    console.error('Stripe API error:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}

// ════════════════════════════════════════════════════════════════════════
// CREAR CHECKOUT SESSION
// Llamamos a la API de Stripe sin SDK (usando fetch directo) para
// evitar agregar dependencias al proyecto.
// ════════════════════════════════════════════════════════════════════════
async function createCheckoutSession(secretKey, payload) {
  const { email, name, origin } = payload;

  // URLs de redirección — relativas al sitio que hace la petición
  const baseUrl = origin || 'https://nancynsalazar.tech';
  const successUrl = `${baseUrl}/audit/?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/audit/?cancelled=true`;

  // Stripe API espera form-urlencoded, no JSON
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('payment_method_types[]', 'card');
  params.append('line_items[0][price_data][currency]', 'mxn');
  params.append('line_items[0][price_data][product_data][name]', 'Audit de Carrera Tech a 5 Años');
  params.append('line_items[0][price_data][product_data][description]', 'Diagnóstico estratégico personalizado para profesionistas mid/senior en tech. Incluye plan a 12 meses generado con IA y sesión de reflexión estratégica.');
  params.append('line_items[0][price_data][unit_amount]', '34900'); // $349.00 MXN en centavos
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);

  if (email) {
    params.append('customer_email', email);
  }

  // Guardamos el nombre como metadata
  if (name) {
    params.append('metadata[buyer_name]', name);
  }

  // Locale en español
  params.append('locale', 'es');

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Stripe error ${response.status}: ${errText}`);
  }

  const session = await response.json();
  return {
    sessionId: session.id,
    url: session.url
  };
}

// ════════════════════════════════════════════════════════════════════════
// VERIFICAR SESSION
// Confirma que un session_id fue pagado y devuelve datos del comprador
// ════════════════════════════════════════════════════════════════════════
async function verifySession(secretKey, payload) {
  const { sessionId } = payload;

  if (!sessionId || !sessionId.startsWith('cs_')) {
    throw new Error('Session ID inválido');
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Stripe error ${response.status}: ${errText}`);
  }

  const session = await response.json();

  // Verificamos que efectivamente esté pagado
  const isPaid = session.payment_status === 'paid';

  return {
    paid: isPaid,
    email: session.customer_email || session.customer_details?.email || null,
    name: session.metadata?.buyer_name || session.customer_details?.name || null,
    amountPaid: session.amount_total,
    currency: session.currency,
    sessionStatus: session.status,
    paymentStatus: session.payment_status,
    createdAt: session.created
  };
}
