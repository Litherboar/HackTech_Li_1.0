# Backend - HackTech Li

API REST para servicios, autenticacion, reservas, disponibilidad, archivos,
auditoria e integraciones externas.

## Stack

- Node.js 20+
- Express
- PostgreSQL
- JWT
- Zod
- Multer para archivos

## Instalacion

Desde esta carpeta:

```powershell
npm install
Copy-Item .env.example .env
```

Configura `DATABASE_URL`, `JWT_SECRET` y los datos de n8n en `.env`:

```env
PORT=4000
DATABASE_URL=postgresql://user:123456789@localhost:5432/HackTech-Li
JWT_SECRET=cambia_esta_clave
N8N_WEBHOOK_TOKEN=cambia_este_token
N8N_WEBHOOK_URL=http://localhost:5678/webhook/reservation-created
```

Ejecuta el esquema, auditoria y datos iniciales:

```powershell
npm run migrate
npm run seed
```

`npm run seed` crea servicios de prueba y, si no existe, el usuario admin:

```text
admin@fisioterapeutali.com
Admin12345
```

Usa esa contrasena solo como credencial inicial de desarrollo.

## Comandos

```powershell
npm run dev          # desarrollo con nodemon y liberacion automatica del puerto
npm start            # ejecucion normal
npm run migrate      # ejecuta database/*.sql
npm run seed         # crea datos iniciales sin duplicarlos
npm run test:smoke   # pruebas de API
```

## Rutas principales

Publicas:

- `GET /api/health`
- `GET /api/services`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/reservations/availability`
- `POST /api/reservations/public`
- `PATCH /api/reservations/public/:id/cancel`
- `PATCH /api/reservations/public/:id/reschedule`
- `POST /api/files/public`
- `POST /api/chat`

Protegidas con JWT y rol `admin` o `staff`:

- `GET /api/reservations`
- `GET /api/reservations/:id`
- `PATCH /api/reservations/:id/status`
- `PATCH /api/reservations/:id/reschedule`
- `GET /api/audit-logs`
- `POST /api/files/reservations/:reservationId`
- `GET /api/files/reservations/:reservationId`
- `GET /api/files/:id/download`

Integracion n8n:

- `PATCH /api/integrations/n8n/reservations/:id/status`

La ruta de integracion usa `x-integration-token`, no JWT. El backend registra
los cambios recibidos desde n8n en `operation_logs`.

## Crear una reserva

`POST /api/reservations/public` recibe:

```json
{
  "fullName": "Paciente de prueba",
  "email": "paciente@example.com",
  "phone": "3000000000",
  "serviceId": 1,
  "startTime": "2026-09-10T14:00:00-05:00",
  "endTime": "2026-09-10T14:45:00-05:00",
  "notes": "Primera valoracion"
}
```

El backend valida el servicio, el rango y los cruces de horarios antes de
guardar. Si la reserva se crea, envia a n8n un evento `reservation.created`
cuando `N8N_WEBHOOK_URL` esta configurada.

## Disponibilidad

`GET /api/reservations/availability` requiere `from` y `to`. Tambien acepta:

- `serviceId`
- `slotMinutes`
- `dayStartHour`
- `dayEndHour`

Devuelve los slots disponibles calculados por el backend.

## Archivos

Los archivos se guardan en `UPLOAD_DIR`, fuera de la carpeta publica. Los
limites se configuran con `MAX_FILE_SIZE_BYTES` y `MAX_FILES_PER_REQUEST`.
Los formatos aceptados son PDF, JPG, PNG, WEBP y DOCX.

## Integracion n8n

El backend envia:

```json
{
  "event": "reservation.created",
  "reservation": {},
  "client": {},
  "service": {}
}
```

El header debe coincidir con el token configurado en n8n:

```text
x-integration-token: <N8N_WEBHOOK_TOKEN>
```

La configuracion del workflow y de las credenciales externas esta en
[automation/n8n/README.md](../automation/n8n/README.md).

## Pruebas

Con PostgreSQL, `.env` y el backend configurados:

```powershell
npm run test:smoke
```
