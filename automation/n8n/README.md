# Automatizacion n8n

El workflow `reservation-created-telegram.json` recibe cada reserva nueva del
backend y ejecuta tres acciones en paralelo:

1. Crea una cita en Google Calendar.
2. Envia una confirmacion por Gmail al cliente.
3. Envia una alerta formateada por Telegram.

## Configuracion

1. Inicia n8n:

   ```powershell
   npx --yes n8n start
   ```

   Abre `http://localhost:5678`.
2. Crea una credencial `Header Auth` llamada `HackTech Li Integration Token`.
3. Configura esa credencial con:
   - Header name: `x-integration-token`
   - Header value: el mismo valor de `N8N_WEBHOOK_TOKEN` del backend.
4. Importa `reservation-created-telegram.json` desde **Workflows > Import from File**.
5. En **Notificar por Telegram**, selecciona la credencial del bot y escribe
   directamente el Chat ID o configura `TELEGRAM_CHAT_ID`.
6. En **Crear cita en Google Calendar**, pulsa **Connect to Google Calendar**.
   Autoriza la cuenta de Google y selecciona el calendario `primary`.
7. En **Enviar confirmacion por Gmail**, selecciona la cuenta Gmail
   autorizada. El campo **To** usa el correo enviado por la reserva.
8. Si Google solicita OAuth manual, habilita **Google Calendar API** y **Gmail
   API** en Google Cloud, agrega tu correo como usuario de prueba y registra el
   OAuth Redirect URL que n8n muestra.
9. Publica o activa el workflow y copia la URL de produccion del nodo
   **Reserva creada**.
10. Configura en `backend/.env`:

```env
N8N_WEBHOOK_TOKEN=el_mismo_token_configurado_en_n8n
N8N_WEBHOOK_URL=https://tu-n8n.example.com/webhook/reservation-created
```

Reinicia el backend despues de cambiar el archivo `.env`.

Las horas seleccionadas en el frontend se interpretan como hora de Colombia
(UTC-5). El frontend las envia al backend como UTC equivalente; por ejemplo,
9:30 a. m. en Colombia se transmite como `14:30Z`. Esto evita que Calendar
muestre un desfase de cinco horas.

## Prueba rapida

Crea una reserva desde la web. El backend enviara un `POST` a n8n con este evento:

```json
{
  "event": "reservation.created",
  "reservation": {},
  "client": {},
  "service": {}
}
```

El workflow ignora otros eventos. Para `reservation.created` usa los datos del
cliente, servicio y reserva para Calendar, Gmail y Telegram.

Al recibir `reservation.created`, las tres acciones salen del nodo de
validacion. Si importas una nueva version del JSON, vuelve a seleccionar las
credenciales en los tres nodos antes de publicar.

La URL de prueba de n8n (`/webhook-test/...`) solo funciona mientras el workflow esta en modo ejecucion manual; para el backend usa siempre la URL de produccion (`/webhook/...`).

## Prueba completa

1. Ejecuta PostgreSQL, backend y n8n.
2. Confirma que el workflow este publicado/activo.
3. Crea una reserva con un correo real.
4. Revisa **Executions** en n8n.
5. Confirma que los nodos Telegram, Calendar y Gmail terminen en verde.
6. Verifica el evento en Google Calendar, el correo en Gmail y el mensaje en
   Telegram.

Las reservas creadas antes de publicar el workflow no se reenvian
automaticamente.

## Alcance actual

Implementado:

- Notificacion Telegram por cada reserva nueva.
- Evento de Google Calendar por cada reserva nueva.
- Confirmacion Gmail inmediata al cliente.

Todavia no implementado:

- Recordatorio Gmail automatico 24 horas antes.
- Comandos `/correo reserva <id>` y `/buscarcorreo <texto>` desde Telegram.

Estas funciones requieren workflows adicionales y, para evitar duplicados,
persistencia del estado de recordatorios en el backend.
