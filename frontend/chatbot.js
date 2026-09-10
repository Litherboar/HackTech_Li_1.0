(() => {
  const chatbotIntents = [
    {
      keywords: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'hey', 'saludo'],
      responses: [
        'Hola, soy Li, tu asistente virtual. Puedo orientarte sobre servicios, horarios, precios y reservas. ¿Qué te gustaría saber?',
        '¡Hola! Estoy aquí para ayudarte a conocer el consultorio y encontrar el siguiente paso para tu cita.'
      ]
    },
    {
      keywords: ['gracias', 'muchas gracias', 'perfecto', 'listo', 'entendido'],
      responses: [
        'Con mucho gusto. Si necesitas algo más, aquí estaré.',
        'Perfecto. También puedo ayudarte a revisar servicios, precios o el proceso de reserva.'
      ]
    },
    {
      keywords: ['servicio', 'servicios', 'tratamiento', 'terapia', 'que hacen', 'ofrecen'],
      responses: [
        'Ofrecemos rehabilitación deportiva, descargas musculares y neurorrehabilitación. También contamos con valoración inicial, terapia física, punción seca, terapia neural, PRP y sueroterapia.',
        'Puedo orientarte en rehabilitación deportiva, descargas musculares, neurorrehabilitación y procedimientos especializados. ¿Buscas recuperarte de una lesión, aliviar tensión o iniciar una valoración?'
      ]
    },
    {
      keywords: ['horario', 'horarios', 'atienden', 'abren', 'disponible', 'hora'],
      responses: [
        'Atendemos en Tunja de lunes a viernes, y en Turmequé los sábados y domingos. El horario de atención es de 7:00 a. m. a 8:00 p. m.',
        'Nuestro horario general es de 7:00 a. m. a 8:00 p. m. La sede de Tunja funciona entre semana y la de Turmequé los fines de semana.'
      ]
    },
    {
      keywords: ['reserv', 'cita', 'agendar', 'agenda', 'como separar', 'turno'],
      responses: [
        'Para reservar, selecciona “Agendar Cita” o “Reservar Servicio”. Elige el servicio, la fecha y un horario disponible; luego completa tus datos y confirma.',
        'Claro. Puedes iniciar la reserva desde el botón “Agendar Cita”. El sistema te mostrará los horarios realmente disponibles antes de confirmar.'
      ],
      action: 'reserve'
    },
    {
      keywords: ['precio', 'precios', 'cuanto', 'costo', 'valor', 'vale'],
      responses: [
        'Los precios dependen del servicio: las terapias y la valoración parten desde $100.000, las descargas desde $70.000 y los procedimientos especializados desde $120.000.',
        'En el formulario de reserva encontrarás el precio exacto de cada opción. Como referencia, nuestros servicios parten desde $70.000.'
      ]
    },
    {
      keywords: ['ubicacion', 'sede', 'tunja', 'turmeque', 'direccion', 'donde'],
      responses: [
        'Tenemos atención en Tunja y Turmequé, Boyacá. Para confirmar disponibilidad en cada sede, escríbenos por WhatsApp al 311 398 1422.',
        'La atención se divide entre Tunja, de lunes a viernes, y Turmequé, los fines de semana. Nuestro equipo puede confirmarte la sede antes de tu cita.'
      ]
    },
    {
      keywords: ['whatsapp', 'telefono', 'contacto', 'llamar', 'comunicar'],
      responses: [
        'Puedes contactarnos por WhatsApp en el 311 398 1422. Nuestro equipo te ayudará con dudas y disponibilidad.',
        'El canal directo es WhatsApp: 311 398 1422. Allí pueden confirmar detalles específicos de tu caso.'
      ]
    },
    {
      keywords: ['pago', 'nequi', 'adelantado', 'transferencia', 'consignar'],
      responses: [
        'La reserva requiere el pago anticipado del 100%. El formulario indica Nequi 3113981422 para realizarlo.',
        'Para confirmar la cita se solicita el pago anticipado completo por Nequi al 3113981422.'
      ]
    },
    {
      keywords: ['archivo', 'documento', 'adjuntar', 'historia', 'examen', 'resultado'],
      responses: [
        'Puedes adjuntar hasta 5 archivos opcionales en PDF, JPG, PNG, WEBP o DOCX, con un máximo de 10 MB por archivo.',
        'Si tienes exámenes o documentos útiles, puedes adjuntarlos durante la reserva. La carga es opcional y acepta PDF, imágenes y DOCX.'
      ]
    },
    {
      keywords: ['profesional', 'lina', 'fisioterapeuta', 'li', 'quien atiende'],
      responses: [
        'Lina Murillo es fisioterapeuta egresada de la Universidad de Boyacá, especializada en neurorrehabilitación, terapias alternativas, ATM, bruxismo y rehabilitación deportiva.',
        'La profesional a cargo es Lina Murillo. Su experiencia incluye neurorrehabilitación, rehabilitación deportiva y terapias alternativas.'
      ]
    },
    {
      keywords: ['dolor', 'lesion', 'lesión', 'espalda', 'rodilla', 'cuello', 'hombro', 'musculo', 'músculo'],
      responses: [
        'Puedo orientarte de forma general, pero no puedo diagnosticarte por este chat. Una valoración inicial permite revisar tu caso y definir el tratamiento adecuado. ¿Quieres reservarla?',
        'Para dolor o una lesión, lo más recomendable es una valoración profesional. Si tienes dolor intenso, pérdida de fuerza, adormecimiento o una lesión reciente, busca atención médica prioritaria.'
      ],
      action: 'reserve'
    },
    {
      keywords: ['cancelar', 'cancelacion', 'cancelación', 'cambiar fecha', 'reprogramar', 'aplazar'],
      responses: [
        'Si necesitas cancelar o reprogramar, escríbenos por WhatsApp al 311 398 1422 con tu nombre y los datos de la cita para que el equipo te ayude.',
        'Puedo indicarte el canal correcto: contacta al 311 398 1422 para solicitar un cambio o cancelación de tu reserva.'
      ]
    },
    {
      keywords: ['duracion', 'duración', 'tiempo', 'dura', 'minutos'],
      responses: [
        'La duración depende del servicio. El formulario de reserva muestra los minutos de cada opción y calcula los horarios disponibles.',
        'Cada tratamiento tiene una duración diferente. Puedes consultar el tiempo exacto al seleccionar el servicio en la reserva.'
      ]
    },
    {
      keywords: ['que llevar', 'llevar', 'preparar', 'preparacion', 'preparación'],
      responses: [
        'Lleva ropa cómoda y, si tienes exámenes o antecedentes relevantes, puedes adjuntarlos en el formulario o comentarlos durante la valoración.',
        'No necesitas una preparación especial para iniciar la consulta. Procura llegar con ropa cómoda y compartir cualquier información clínica importante.'
      ]
    }
  ];

  const fallbackResponses = [
    'Puedo ayudarte con servicios, horarios, precios, sedes, contacto, preparación y reservas. Cuéntame qué necesitas.',
    'No estoy segura de haber entendido. ¿Quieres saber sobre una cita, un servicio, los precios o nuestros horarios?',
    'Estoy aquí para orientarte. Prueba preguntando: “¿Qué servicio recomiendan para una lesión?” o “¿Cómo reservo una cita?”'
  ];

  const normalizeText = (value) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  function selectResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
  }

  function findIntent(question) {
    const normalizedQuestion = normalizeText(question);
    return chatbotIntents.find((item) => item.keywords.some((keyword) => normalizedQuestion.includes(normalizeText(keyword))));
  }

  async function askLocalAI(history) {
    const apiBaseUrl = typeof RESERVATION_CONFIG !== 'undefined'
      ? RESERVATION_CONFIG.API_BASE_URL
      : '/api';
    const response = await fetch(`${apiBaseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-10) })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.data?.message) {
      throw new Error(payload?.error?.message || 'La IA local no esta disponible.');
    }

    return payload.data.message;
  }

  function initChatbot() {
    const chatbot = document.getElementById('chatbot');
    const panel = document.getElementById('chatbotPanel');
    const toggle = document.getElementById('chatbotToggle');
    const close = document.getElementById('chatbotClose');
    const form = document.getElementById('chatbotForm');
    const input = document.getElementById('chatbotInput');
    const messages = document.getElementById('chatbotMessages');
    const quickActions = document.getElementById('chatbotQuickActions');
    const unread = document.querySelector('.chatbot-unread');
    const conversation = [];

    if (!chatbot || !panel || !toggle || !form || !input || !messages) return;

    const addMessage = (text, sender) => {
      const message = document.createElement('div');
      message.className = `chatbot-message ${sender}`;
      message.textContent = text;
      messages.appendChild(message);
      messages.scrollTop = messages.scrollHeight;
    };

    const addTypingMessage = () => {
      const message = document.createElement('div');
      message.className = 'chatbot-message bot chatbot-typing';
      message.textContent = 'Escribiendo...';
      messages.appendChild(message);
      messages.scrollTop = messages.scrollHeight;
      return message;
    };

    const sendQuestion = async (question) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) return;
      addMessage(trimmedQuestion, 'user');
      conversation.push({ role: 'user', content: trimmedQuestion });
      const intent = findIntent(trimmedQuestion);
      const typingMessage = addTypingMessage();

      try {
        const answer = await askLocalAI(conversation);
        typingMessage.remove();
        addMessage(answer, 'bot');
        conversation.push({ role: 'assistant', content: answer });
      } catch (error) {
        // Permite usar el chat FAQ cuando Ollama aun no esta instalado o encendido.
        window.setTimeout(() => {
          typingMessage.remove();
          const answer = intent ? selectResponse(intent.responses) : selectResponse(fallbackResponses);
          addMessage(answer, 'bot');
          conversation.push({ role: 'assistant', content: answer });
          if (intent?.action === 'reserve') {
            window.setTimeout(() => {
              addMessage('Cuando quieras, puedo abrirte el formulario para elegir fecha y horario.', 'bot');
            }, 250);
          }
        }, 450);
      }
    };

    const setOpen = (isOpen) => {
      chatbot.classList.toggle('is-open', isOpen);
      panel.setAttribute('aria-hidden', String(!isOpen));
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (unread) unread.hidden = isOpen;
      if (isOpen) window.setTimeout(() => input.focus(), 150);
    };

    addMessage('Hola. Puedo responder tus preguntas sobre servicios, horarios y reservas.', 'bot');

    toggle.addEventListener('click', () => setOpen(!chatbot.classList.contains('is-open')));
    if (close) close.addEventListener('click', () => setOpen(false));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      sendQuestion(input.value);
      input.value = '';
    });

    if (quickActions) {
      quickActions.addEventListener('click', (event) => {
        const button = event.target.closest('[data-chat-question]');
        if (!button) return;
        sendQuestion(button.dataset.chatQuestion || '');
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && chatbot.classList.contains('is-open')) setOpen(false);
    });
  }

  document.addEventListener('DOMContentLoaded', initChatbot);
})();
