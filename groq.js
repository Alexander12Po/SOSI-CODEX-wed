import 'dotenv/config';
import ChatIA from './models/ChatIA.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_HISTORIAL = 20;

export async function chatActivo(jid) {
  const chat = await ChatIA.findOne({ jid }).lean();
  return chat?.activo === true;
}

export async function activarIA(jid) {
  await ChatIA.findOneAndUpdate(
    { jid },
    { $setOnInsert: { historial: [] }, activo: true },
    { upsert: true }
  );
}

export async function desactivarIA(jid) {
  await ChatIA.findOneAndUpdate(
    { jid },
    { activo: false },
    { upsert: true }
  );
}

export async function preguntarIA(jid, mensaje) {
  try {
    // Guarda el mensaje del usuario de forma atómica
    await ChatIA.findOneAndUpdate(
      { jid },
      { $push: { historial: { role: 'user', content: mensaje } }, $setOnInsert: { activo: false } },
      { upsert: true }
    );

    // Lee el historial actualizado
    const chatActual = await ChatIA.findOne({ jid }).lean();
    const historial = chatActual?.historial || [];

    const mensajesParaAPI = [
      { role: 'system', content: 'Eres un amigo cercano charlando por WhatsApp. Responde corto, natural, casual y en español, como lo haría una persona real en un chat. No te presentes como IA a menos que te pregunten directamente.' },
      ...historial.slice(-MAX_HISTORIAL).map(h => ({ role: h.role, content: h.content }))
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: mensajesParaAPI,
        max_tokens: 400
      })
    });
    const data = await res.json();

    if (data.error) {
      console.error('Error de Groq:', data.error.message);
      return null;
    }

    const respuesta = data.choices?.[0]?.message?.content?.trim() || null;

    if (respuesta) {
      // Guarda la respuesta de forma atómica
      await ChatIA.findOneAndUpdate(
        { jid },
        { $push: { historial: { role: 'assistant', content: respuesta } } }
      );

      // Recorta el historial si se pasa del límite (operación separada y segura)
      const chatFinal = await ChatIA.findOne({ jid }).lean();
      if (chatFinal?.historial?.length > MAX_HISTORIAL * 2) {
        const recortado = chatFinal.historial.slice(-MAX_HISTORIAL * 2);
        await ChatIA.findOneAndUpdate({ jid }, { historial: recortado });
      }
    }

    return respuesta;
  } catch (err) {
    console.error('Error conectando con Groq:', err.message);
    return null;
  }
}
