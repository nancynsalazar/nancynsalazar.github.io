// ════════════════════════════════════════════════════════════════════════
// API endpoint: /api/audit
// Backend proxy seguro a Anthropic API
// Esconde tu ANTHROPIC_API_KEY del frontend
// Hosteado en Vercel como serverless function dentro del mismo proyecto
// que nancynsalazar.tech (sin necesidad de CORS abierto)
// ════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validar API key del servidor
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key no configurada en el servidor' });
  }

  try {
    const { type, payload } = req.body;

    if (type === 'plan') {
      // Generar plan a 12 meses con web search en vivo
      const result = await generatePlan(apiKey, payload);
      return res.status(200).json({ success: true, data: result });
    }

    if (type === 'insight') {
      // Generar insight de reflexión (sin web search, más rápido)
      const result = await generateInsight(apiKey, payload);
      return res.status(200).json({ success: true, data: result });
    }

    return res.status(400).json({ error: 'Tipo de petición no reconocido' });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}

// ════════════════════════════════════════════════════════════════════════
// PLAN GENERATOR — con web search activado para datos en vivo
// ════════════════════════════════════════════════════════════════════════
async function generatePlan(apiKey, payload) {
  const { formData, skills, scores } = payload;

  const prompt = `Eres una estratega senior de carrera tech especializada en mercado LATAM (especialmente México). Generas planes prácticos, basados en datos REALES de mercado actual. Usa la herramienta de búsqueda web cuando necesites verificar tendencias salariales actuales, demanda de skills específicas, o roles emergentes en LATAM 2026.

CONTEXTO DE LA PERSONA:
- Nombre: ${formData.name}
- Rol actual: ${formData.role} en ${formData.company}
- Años en tech: ${formData.years}, nivel ${formData.level}
- Perfil: ${formData.profile_type}
- Skills declaradas: ${skills.join(', ')}
- Capacitación actual: ${formData.learning || 'no especificó'}
- Logro reciente: ${formData.achievement || 'no especificó'}
- Uso de IA: ${formData.ai_usage}
- Liderazgo: ${formData.leadership || 'no especificó'}
- Inquietud principal: ${formData.concern}
- Aspiración 5 años: ${formData.aspiration || 'no especificó'}
- Apetito de cambio: ${formData.change_appetite}

SCORES CALCULADOS:
- Resiliencia stack: ${scores.resilience}/100
- Alineación mercado: ${scores.marketAlignment}/100
- Potencial crecimiento: ${scores.growth}/100
- AI-readiness: ${scores.aiReady}/100

INSTRUCCIONES:
1. Si tienes dudas sobre la trayectoria actual de alguna de sus skills, búscala en la web
2. Si necesitas validar tendencias salariales de su rol o roles aspirables, búscalas
3. Si quieres mencionar herramientas, certificaciones o cursos específicos, valida que sigan siendo relevantes en ${new Date().getFullYear()}

OUTPUT: Genera un plan trimestral a 12 meses (4 trimestres). Para cada trimestre incluye:
- "title": título del trimestre (5-7 palabras)
- "narrative": 2-3 oraciones explicando el foco del trimestre y por qué tiene sentido en este momento. Si usaste data del mercado, menciónalo brevemente (ej. "según búsquedas recientes en LinkedIn...")
- "actions": array de 3-4 acciones concretas y específicas (no genéricas tipo "leer un libro")

REGLAS DE ESTILO:
- Acciones específicas a su contexto, no consejos genéricos
- Realistas (no requiere abandonar el trabajo)
- Si AI-readiness está bajo, Q1 debe atacar eso
- Tono: directo, honesto, profesional. Tuteo informal pero no infantilizado
- Sin clichés tipo "abrazar el cambio" o "salir de tu zona de confort"
- Sin hashtags ni emojis
- Usar "con base en" (no "en base a"); usar "sólo" con tilde cuando significa "únicamente"
- Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown fences, sin explicaciones

FORMATO DE RESPUESTA:
{
  "quarters": [
    {"title": "...", "narrative": "...", "actions": ["...", "...", "..."]},
    {"title": "...", "narrative": "...", "actions": ["...", "...", "..."]},
    {"title": "...", "narrative": "...", "actions": ["...", "...", "..."]},
    {"title": "...", "narrative": "...", "actions": ["...", "...", "..."]}
  ]
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 2  // limitado a 2 búsquedas para asegurar que cabe en el timeout de Vercel (60s)
      }],
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Extraer todo el texto de los content blocks (puede venir mezclado con tool_use)
  const fullText = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .replace(/```json|```/g, '')
    .trim();

  // Intentar parsear como JSON
  try {
    return JSON.parse(fullText);
  } catch (parseErr) {
    // Buscar bloque JSON dentro del texto (Claude a veces agrega explicación a pesar de instrucciones)
    const match = fullText.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('No se pudo parsear el plan: ' + fullText.substring(0, 200));
  }
}

// ════════════════════════════════════════════════════════════════════════
// INSIGHT GENERATOR — sin web search (más rápido para reflexión)
// ════════════════════════════════════════════════════════════════════════
async function generateInsight(apiKey, payload) {
  const { question, answer, context } = payload;

  const prompt = `Eres una coach senior de carrera tech, directa y honesta como Esther Perel o Lara Hogan. NO eres terapeuta. NO usas frases motivacionales vacías.

CONTEXTO de la persona:
- ${context.role}, ${context.years} años en tech, nivel ${context.level}
- Inquietud principal: ${context.concern}
- Aspiración: ${context.aspiration || 'no especificada'}

PREGUNTA reflexiva que se le hizo:
"${question}"

RESPUESTA de la persona:
"${answer}"

Genera un insight personalizado en 3-4 oraciones que:
1. Refleje lo que su respuesta REVELA (no sólo lo que dice)
2. Identifique un patrón, tensión o supuesto no examinado
3. Cierre con una pregunta o provocación más precisa que la abra a profundizar
4. Sea directa. Sin clichés. Sin "es importante que..." Sin "lo más relevante es..."
5. Tono: como una mentora honesta que ya conoce el tema
6. Sin hashtags ni emojis
7. Usar "con base en" (no "en base a"); usar "sólo" con tilde cuando significa "únicamente"

Responde ÚNICAMENTE con el texto del insight, sin preámbulo.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  return { insight: text };
}
