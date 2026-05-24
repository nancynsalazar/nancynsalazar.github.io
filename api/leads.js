// ════════════════════════════════════════════════════════════════════════
// API endpoint: /api/leads
// Recibe datos del frontend y los reenvía al Apps Script de Google
// que los guarda en el Sheet "Audit de Carrera Tech — Base de Datos"
//
// Tipos de eventos:
//   - "compra"  → se llama cuando Stripe confirma pago (entra al audit)
//   - "audit"   → se llama cuando se genera el reporte completo
// ════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appsScriptUrl = process.env.SHEETS_APPS_SCRIPT_URL;
  const sharedSecret = process.env.SHEETS_SECRET;

  if (!appsScriptUrl || !sharedSecret) {
    console.error('Faltan variables de entorno: SHEETS_APPS_SCRIPT_URL o SHEETS_SECRET');
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  try {
    const { type, payload } = req.body;

    if (type !== 'compra' && type !== 'audit') {
      return res.status(400).json({ error: 'Tipo de evento no reconocido' });
    }

    // Reenviar al Apps Script con el secreto compartido
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: sharedSecret,
        type: type,
        payload: payload || {}
      }),
      redirect: 'follow'  // Apps Script redirige internamente, hay que seguir el redirect
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Apps Script ${response.status}: ${errText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Apps Script devolvió error');
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    // Log el error pero NO bloqueamos el flujo del usuario
    // Si la captura de leads falla, el audit sigue funcionando
    console.error('Leads error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error al guardar lead'
    });
  }
}
