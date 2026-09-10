const env = require("../config/env");

const SYSTEM_PROMPT =
  "Eres 'Li', el asistente virtual de un consultorio de rehabilitacion en Tunja y Turmeque, Boyaca. " +
  "Responde de forma breve, clara y amable en espanol. Ayuda con servicios, horarios, precios, sedes y el proceso de reserva de citas. " +
  "Si no sabes algo, dilo con honestidad y sugiere contactar por WhatsApp al 311 398 1422.";

async function postChat(req, res, next) {
  try {
    const { messages } = req.body;

    const response = await fetch(`${env.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.ollamaModel,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 300
        }
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(payload?.error || "Error consultando Ollama");
      error.status = 502;
      error.code = "AI_PROVIDER_ERROR";
      throw error;
    }

    const message = payload?.message?.content?.trim();

    if (!message) {
      const error = new Error("La IA no devolvio una respuesta valida");
      error.status = 502;
      error.code = "AI_EMPTY_RESPONSE";
      throw error;
    }

    res.json({
      data: { message }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  postChat
};
