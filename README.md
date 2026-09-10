# HackTech Li

Aplicacion web para gestionar reservas de fisioterapia. El proyecto incluye:

- Frontend estatico para clientes y panel administrativo.
- API REST con Node.js, Express, PostgreSQL, JWT y Zod.
- Validacion de disponibilidad y prevencion de cruces de horarios.
- Carga privada de archivos asociados a reservas.
- Auditoria de acciones importantes.
- Automatizacion n8n para cada reserva nueva:
  - Crear evento en Google Calendar.
  - Enviar confirmacion por Gmail.
  - Notificar al administrador por Telegram.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL activo.
- n8n activo para las notificaciones y servicios externos.
- Una cuenta de Google para Calendar y Gmail.
- Un bot de Telegram y el Chat ID del administrador.

## Estructura

```text
frontend/                       Sitio publico y panel administrativo
backend/src/                    API, controladores, repositorios y validaciones
backend/scripts/                Migracion, seed, pruebas y desarrollo
database/                       Scripts SQL de esquema y auditoria
automation/n8n/                 Workflow de reservas e instrucciones
docs/API.md                     Referencia detallada de la API
```

## Instalacion local

### 1. Base de datos

Crea una base de datos PostgreSQL y configura las credenciales en `backend/.env`.
No es necesario usar exactamente estos nombres, pero el ejemplo del proyecto usa:

```sql
CREATE USER "user" WITH PASSWORD '123456789';
CREATE DATABASE "HackTech-Li" OWNER "user";
GRANT ALL PRIVILEGES ON DATABASE "HackTech-Li" TO "user";
```

### 2. Configuracion del backend

```powershell
cd C:\Users\juane\OneDrive\Desktop\HackTech-Li\backend
Copy-Item .env.example .env
npm install
npm run migrate
npm run seed
```

Edita `backend/.env` y define al menos:

```env
DATABASE_URL=postgresql://user:123456789@localhost:5432/HackTech-Li
JWT_SECRET=cambia_esta_clave
N8N_WEBHOOK_TOKEN=cambia_este_token
N8N_WEBHOOK_URL=http://localhost:5678/webhook/reservation-created
```

La semilla crea servicios de prueba y el usuario administrativo:

```text
Correo: admin@fisioterapeutali.com
Password temporal: Admin12345
```

Cambia la contrasena antes de usar el sistema fuera de una demo.

### 3. Ejecutar backend y frontend

En una terminal:

```powershell
cd C:\Users\juane\OneDrive\Desktop\HackTech-Li\backend
npm run dev
```

La API queda en `http://localhost:4000` y sirve tambien los archivos de
`frontend/`. Abre `http://localhost:4000`.

Para probar el backend:

```powershell
npm run test:smoke
```

### 4. Ejecutar n8n

En otra terminal:

```powershell
npx --yes n8n start
```

Abre `http://localhost:5678`. n8n debe permanecer ejecutandose mientras se
prueba la aplicacion. La primera ejecucion puede necesitar internet para
descargar n8n. Para instalaciones repetidas se puede instalar globalmente:

```powershell
npm install -g n8n
n8n start
```

## Automatizacion de reservas

La configuracion completa esta en
[automation/n8n/README.md](automation/n8n/README.md). El archivo para importar es:

`automation/n8n/reservation-created-telegram.json`

El workflow recibe `reservation.created` desde el backend y ejecuta en paralelo:

1. Google Calendar: crea el evento en el calendario seleccionado.
2. Gmail: envia una confirmacion al correo de la reserva.
3. Telegram: envia una alerta formateada al Chat ID configurado.

Al importar el archivo hay que seleccionar las credenciales de Telegram,
Google Calendar y Gmail, guardar y publicar el workflow.

## Frontend

El frontend usa `/api` cuando se sirve desde el backend. En desarrollo local,
`frontend/reservation-config.js` apunta a `http://localhost:4000/api`.

Los clientes pueden:

- Consultar servicios y horarios disponibles.
- Registrarse e iniciar sesion.
- Crear, cancelar y reprogramar sus reservas.
- Adjuntar archivos publicos asociados a una reserva.

El personal autorizado puede consultar reservas, cambiar estados, reprogramar
reservas y gestionar archivos desde el panel administrativo.

## Seguridad y limites

- Las rutas administrativas requieren JWT y roles `admin` o `staff`.
- La integracion n8n usa el header `x-integration-token`.
- Los archivos se guardan fuera de la carpeta publica.
- Tamano maximo por archivo: 10 MB por defecto.
- Maximo de archivos por solicitud: 5 por defecto.
- No publiques `.env`, tokens, secretos OAuth ni credenciales de Telegram.

## Documentacion adicional

- [API del backend](docs/API.md)
- [Backend](backend/README.md)
- [Automatizacion n8n](automation/n8n/README.md)
