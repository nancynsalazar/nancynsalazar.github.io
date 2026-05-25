// ════════════════════════════════════════════════════════════════════════
// API endpoint: /api/report
// Recupera un audit archivado por su audit_id desde el Apps Script
// que lo lee del Google Sheet
// ════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appsScriptUrl = process.env.SHEETS_APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const auditId = req.query.id;
  if (!auditId || auditId.length < 10) {
    return res.status(400).json({ success: false, error: 'ID inválido' });
  }

  try {
    // Apps Script con GET sigue redirects, hay que pasarlos
    const response = await fetch(`${appsScriptUrl}?id=${encodeURIComponent(auditId)}`, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Apps Script ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('Report fetch error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error al recuperar reporte'
    });
  }
}
