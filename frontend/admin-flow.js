/**
 * admin-flow.js
 *
 * ANTES: el "login" solo comparaba una contraseña fija ('1234') guardada
 * en el propio archivo y marcaba una bandera en sessionStorage -nunca
 * hablaba con el backend-. Por eso GET /api/reservations (que exige
 * requireAuth + rol admin/staff, ver backend/src/routes/reservation.routes.js)
 * siempre respondía 401, y el catch de loadAdminReservations() mostraba
 * "Error de conexión con el servidor" aunque el servidor sí respondía
 * -solo que rechazaba la petición por no traer ningún token-.
 *
 * AHORA: el login llama a POST /api/auth/login (email + password reales,
 * ver seed.js para las credenciales), guarda el JWT que devuelve, y lo
 * manda como header Authorization en cada llamada protegida.
 */

const ADMIN_TOKEN_KEY = 'fisio_admin_token';
const ADMIN_FRONTEND_SESSION_KEY = 'fisio_admin_frontend_session';
const ADMIN_EMAIL = 'admin@fisioterapeutali.com';
const ADMIN_PASSWORD = 'Admin12345';
const LOCAL_RESERVATIONS_KEY = 'fisio_local_reservations';

// El backend exige correo + contraseña (no admite solo contraseña), así
// que para mantener el login de un único campo se usa siempre este
// correo fijo -el del usuario admin creado por npm run seed- por
// detrás. La contraseña real sigue siendo la que tenga esa cuenta en la
// base de datos (ver nota importante: el backend exige mínimo 8
// caracteres, así que "1234" tal cual no es válido).

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    setupReservationFilters();
});

function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function checkAdminAuth() {
    const isAuth = Boolean(getAdminToken()) || Boolean(sessionStorage.getItem(ADMIN_FRONTEND_SESSION_KEY));
    const loginSection = document.getElementById('adminLoginSection');
    const dashboardContent = document.getElementById('adminDashboardContent');

    if (isAuth) {
        if (loginSection) loginSection.style.display = 'none';
        if (dashboardContent) dashboardContent.style.display = 'block';
        loadAdminReservations();
    } else {
        if (loginSection) loginSection.style.display = 'flex';
        if (dashboardContent) dashboardContent.style.display = 'none';
    }
}

async function handleAdminLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById('adminEmail');
    const email = (emailInput ? emailInput.value : ADMIN_EMAIL).trim().toLowerCase();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = document.getElementById('adminLoginBtn');

    if (errorDiv) errorDiv.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;

    try {
        if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
            throw new Error('Correo o contraseña incorrectos.');
        }

        let backendToken = null;

        try {
            const res = await fetch(`${RESERVATION_CONFIG.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const json = await res.json().catch(() => null);

            if (res.ok && json?.data?.token) {
                const role = json.data.user?.role;
                if (role === 'admin' || role === 'staff') {
                    backendToken = json.data.token;
                }
            }
        } catch (backendError) {
            console.warn('Backend no disponible para el login administrativo; se usará la sesión frontend de demo.', backendError);
        }

        if (backendToken) {
            sessionStorage.setItem(ADMIN_TOKEN_KEY, backendToken);
            sessionStorage.removeItem(ADMIN_FRONTEND_SESSION_KEY);
        } else {
            // Contingencia exclusivamente para el prototipo frontend.
            // Permite acceder al portal aun cuando la BD todavía no tenga
            // la cuenta solicitada o el backend no esté disponible.
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            sessionStorage.setItem(ADMIN_FRONTEND_SESSION_KEY, JSON.stringify({
                email,
                role: 'admin',
                demo: true
            }));
        }

        checkAdminAuth();
    } catch (error) {
        if (errorDiv) {
            errorDiv.textContent = error.message || 'No se pudo iniciar sesión.';
            errorDiv.style.display = 'block';
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function handleAdminLogout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_FRONTEND_SESSION_KEY);
    checkAdminAuth();
}

let cachedReservations = [];
let pendingCancellationId = null;

function setupReservationFilters() {
    ['reservationSearch', 'reservationStatusFilter', 'reservationDateFilter'].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('input', applyReservationFilters);
        if (input && input.tagName === 'SELECT') input.addEventListener('change', applyReservationFilters);
    });

    const confirmButton = document.getElementById('confirmCancelReservationBtn');
    if (confirmButton) confirmButton.addEventListener('click', confirmCancellation);
}

function applyReservationFilters() {
    const search = (document.getElementById('reservationSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('reservationStatusFilter')?.value || '';
    const date = document.getElementById('reservationDateFilter')?.value || '';
    const rows = document.querySelectorAll('#adminTableBody tr[data-reservation-row]');
    let visible = 0;

    rows.forEach((row) => {
        const matchesSearch = !search || row.dataset.search.includes(search);
        const matchesStatus = !status || row.dataset.status === status;
        const matchesDate = !date || row.dataset.date === date;
        const isVisible = matchesSearch && matchesStatus && matchesDate;
        row.classList.toggle('d-none', !isVisible);
        if (isVisible) visible += 1;
    });

    const result = document.getElementById('reservationFilterResult');
    if (result) result.textContent = `${visible} reserva${visible === 1 ? '' : 's'} visible${visible === 1 ? '' : 's'}`;
}

function clearReservationFilters() {
    ['reservationSearch', 'reservationStatusFilter', 'reservationDateFilter'].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    applyReservationFilters();
}

async function loadAdminReservations() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    const token = getAdminToken();
    const demoSession = sessionStorage.getItem(ADMIN_FRONTEND_SESSION_KEY);
    if (!token && !demoSession) {
        checkAdminAuth();
        return;
    }

    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando listado de reservas...</td></tr>`;

    // Si la sesión es frontend de demo, no existe JWT para consultar las rutas
    // protegidas. Mostramos las reservas que se hayan creado desde este sitio.
    if (!token && demoSession) {
        renderLocalAdminReservations(tbody);
        return;
    }

    try {
        const response = await fetch(`${RESERVATION_CONFIG.API_BASE_URL}/reservations`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // El token puede haber expirado (ver JWT_EXPIRES_IN en el backend) o
        // ser inválido; en ese caso no es un problema de conexión, hay que
        // pedir que inicie sesión de nuevo.
        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            sessionStorage.setItem(ADMIN_FRONTEND_SESSION_KEY, JSON.stringify({ email: ADMIN_EMAIL, role: 'admin', demo: true }));
            renderLocalAdminReservations(tbody);
            return;
        }

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const result = await response.json();
        // El backend no aplica ningún ORDER BY (ver listReservations en
        // reservation.repository.js), así que Postgres puede devolverlas
        // en cualquier orden. Se ordenan aquí por fecha de creación, de
        // la reserva más reciente a la más antigua.
        cachedReservations = (result.data || []).sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        if (cachedReservations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary py-5">No hay reservas registradas en el sistema.</td></tr>`;
            return;
        }

        // El listado de reservas no trae los archivos adjuntos (la consulta
        // no los incluye) -por eso nunca aparecían, aunque sí se hubieran
        // subido-. Sí existe un endpoint por reserva
        // (GET /api/files/reservations/:id), así que los pedimos todos en
        // paralelo y los guardamos junto a cada reserva antes de dibujar la tabla.
        await Promise.all(
            cachedReservations.map(async (res) => {
                try {
                    const filesRes = await fetch(`${RESERVATION_CONFIG.API_BASE_URL}/files/reservations/${res.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (filesRes.ok) {
                        const filesJson = await filesRes.json();
                        res.files = filesJson.data || [];
                    } else {
                        const errorJson = await filesRes.json().catch(() => null);
                        console.error(
                            `No se pudieron cargar los archivos de la reserva #${res.id}: HTTP ${filesRes.status}`,
                            errorJson
                        );
                        res.files = [];
                    }
                } catch (fileError) {
                    console.error(`Error de red al pedir archivos de la reserva #${res.id}:`, fileError);
                    res.files = [];
                }
            })
        );

        tbody.innerHTML = '';
        cachedReservations.forEach(res => {
            const tr = document.createElement('tr');

            // Nombres reales que devuelve el backend (ver
            // repositories/reservation.repository.js: listReservations).
            const resId = res.id;
            const fullName = res.client_name || 'Sin nombre';
            const email = res.client_email || 'Sin correo';
            const serviceName = res.service_name || `Servicio #${res.service_id || 'N/A'}`;
            const phone = res.client_phone || 'N/A';
            const status = res.status || 'pending';
            const filterDate = res.start_time ? new Date(res.start_time).toISOString().slice(0, 10) : '';

            const formattedDate = res.start_time ? formatDateTime(res.start_time) : 'Fecha no especificada';

            const statusBadges = {
                pending: '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">Pendiente</span>',
                confirmed: '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">Confirmada</span>',
                cancelled: '<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">Cancelada</span>',
                completed: '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1">Completada</span>'
            };

            const files = res.files || [];
            const filesBadge = files.length > 0
                ? files
                    .map(
                        (f) => `
                    <button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-2 py-0 mb-1 d-flex align-items-center gap-1 text-truncate" style="max-width: 170px;" title="Descargar ${escapeHtml(f.original_name)}" onclick="downloadReservationFile(${f.id})">
                        <i class="fa-solid fa-download"></i><span class="text-truncate">${escapeHtml(f.original_name)}</span>
                    </button>`
                    )
                    .join('')
                : `<span class="badge bg-secondary-subtle text-secondary px-2 py-1">Ninguno</span>`;

            const actionButtons = [];
            if (status === 'pending') {
                actionButtons.push(`<button class="btn btn-outline-success btn-sm rounded-pill px-3 shadow-none me-1" onclick="approveReservation(${resId})" title="Aprobar reserva">
                    <i class="fa-solid fa-check"></i>
                </button>`);
            }
            if (status === 'pending' || status === 'confirmed') {
                actionButtons.push(`<button class="btn btn-outline-danger btn-sm rounded-pill px-3 shadow-none" onclick="cancelReservation(${resId})" title="Cancelar reserva">
                    <i class="fa-solid fa-ban"></i>
                </button>`);
            }

            tr.innerHTML = `
                <td class="ps-4">
                    <div class="fw-bold text-dark">${fullName}</div>
                    <div class="small text-secondary">${email}</div>
                </td>
                <td><span class="fw-medium">${serviceName}</span></td>
                <td><span class="text-secondary">${formattedDate}</span></td>
                <td><span class="text-secondary">${phone}</span></td>
                <td>${filesBadge}</td>
                <td>${statusBadges[status] || status}</td>
                <td class="text-center pe-4">
                    ${actionButtons.length > 0 ? actionButtons.join('') : '<span class="text-secondary small">—</span>'}
                </td>
            `;
            tr.dataset.reservationRow = 'true';
            tr.dataset.status = status;
            tr.dataset.date = filterDate;
            tr.dataset.search = `${fullName} ${email} ${serviceName} ${phone}`.toLowerCase();
            tbody.appendChild(tr);
        });
        applyReservationFilters();

    } catch (error) {
        console.error("Error al cargar administración:", error);
        const localReservations = getLocalReservations();
        if (localReservations.length > 0) {
            renderLocalAdminReservations(tbody);
            const notice = document.createElement('tr');
            notice.innerHTML = `<td colspan="7" class="text-center text-warning small py-2">No fue posible consultar el servidor. Mostrando las reservas guardadas en este navegador.</td>`;
            tbody.prepend(notice);
        } else {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-5">No fue posible cargar las reservas. Verifica que el backend esté activo.</td></tr>`;
        }
    }
}


function getLocalReservations() {
    try {
        const raw = localStorage.getItem(LOCAL_RESERVATIONS_KEY);
        const data = raw ? JSON.parse(raw) : [];
        return Array.isArray(data) ? data : [];
    } catch (_) {
        return [];
    }
}

async function renderLocalAdminReservations(tbody) {
    const localReservations = getLocalReservations()
        .sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));

    cachedReservations = localReservations;

    if (localReservations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary py-5">No hay reservas locales para mostrar. Crea una reserva desde el sitio web.</td></tr>`;
        return;
    }

    // Los archivos no se guardan en localStorage porque pueden pesar varios MB.
    // Sus blobs se conservan en IndexedDB y aquí recuperamos sus metadatos.
    const rows = await Promise.all(localReservations.map(async (res) => {
        const localFiles = await getLocalReservationFiles(res.id);
        return { res, localFiles };
    }));

    tbody.innerHTML = '';
    rows.forEach(({ res, localFiles }) => {
        const tr = document.createElement('tr');
        const status = res.status || 'pending';
        const filterDate = res.start_time ? new Date(res.start_time).toISOString().slice(0, 10) : '';
        const statusBadges = {
            pending: '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">Pendiente</span>',
            confirmed: '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">Confirmada</span>',
            cancelled: '<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">Cancelada</span>',
            completed: '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1">Completada</span>'
        };

        const metadataFiles = Array.isArray(res.files) ? res.files : [];
        const files = localFiles.length > 0 ? localFiles : metadataFiles;
        const filesBadge = files.length > 0
            ? files.map((file, index) => {
                const fileName = file.original_name || file.name || `Archivo ${index + 1}`;
                const localKey = file.key || '';
                const button = localKey
                    ? `<button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-2 py-0 mb-1 d-flex align-items-center gap-1 text-truncate" style="max-width: 190px;" title="Descargar ${escapeHtml(fileName)}" onclick="downloadLocalReservationFile('${escapeHtml(localKey)}')">
                        <i class="fa-solid fa-download"></i><span class="text-truncate">${escapeHtml(fileName)}</span>
                    </button>`
                    : `<span class="d-flex align-items-center gap-1 small text-secondary mb-1" title="Archivo registrado en la reserva">
                        <i class="fa-solid fa-file"></i><span class="text-truncate" style="max-width: 160px;">${escapeHtml(fileName)}</span>
                    </span>`;
                return button;
            }).join('')
            : `<span class="badge bg-secondary-subtle text-secondary px-2 py-1">Ninguno</span>`;

        const actionButtons = [];
        if (status === 'pending') {
            actionButtons.push(`<button class="btn btn-outline-success btn-sm rounded-pill px-3 shadow-none me-1" onclick="approveReservation(${JSON.stringify(res.id)})" title="Aprobar reserva">
                <i class="fa-solid fa-check"></i>
            </button>`);
        }
        if (status === 'pending' || status === 'confirmed') {
            actionButtons.push(`<button class="btn btn-outline-danger btn-sm rounded-pill px-3 shadow-none" onclick="cancelReservation(${JSON.stringify(res.id)})" title="Cancelar reserva">
                <i class="fa-solid fa-ban"></i>
            </button>`);
        }

        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-bold text-dark">${escapeHtml(res.client_name || res.fullName || 'Sin nombre')}</div>
                <div class="small text-secondary">${escapeHtml(res.client_email || res.email || 'Sin correo')}</div>
            </td>
            <td><span class="fw-medium">${escapeHtml(res.service_name || 'Servicio')}</span></td>
            <td><span class="text-secondary">${res.start_time ? formatDateTime(res.start_time) : 'Fecha no especificada'}</span></td>
            <td><span class="text-secondary">${escapeHtml(res.client_phone || res.phone || 'N/A')}</span></td>
            <td>${filesBadge}</td>
            <td>${statusBadges[status] || status}</td>
            <td class="text-center pe-4">${actionButtons.length > 0 ? actionButtons.join('') : '<span class="text-secondary small">—</span>'}</td>
        `;
        tr.dataset.reservationRow = 'true';
        tr.dataset.status = status;
        tr.dataset.date = filterDate;
        tr.dataset.search = `${res.client_name || res.fullName || ''} ${res.client_email || res.email || ''} ${res.service_name || ''} ${res.client_phone || res.phone || ''}`.toLowerCase();
        tbody.appendChild(tr);
    });
    applyReservationFilters();
}

async function getLocalReservationFiles(reservationId) {
    if (typeof indexedDB === 'undefined') return [];

    try {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('fisio_admin_files_db', 1);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains('reservation_files')) {
                    const store = database.createObjectStore('reservation_files', { keyPath: 'key' });
                    store.createIndex('reservationId', 'reservationId', { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const files = await new Promise((resolve, reject) => {
            const tx = db.transaction('reservation_files', 'readonly');
            const index = tx.objectStore('reservation_files').index('reservationId');
            const request = index.getAll(String(reservationId));
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });

        db.close();
        return files.sort((a, b) => (a.index || 0) - (b.index || 0));
    } catch (error) {
        console.warn(`No se pudieron recuperar los archivos locales de la reserva #${reservationId}:`, error);
        return [];
    }
}

async function downloadLocalReservationFile(fileKey) {
    if (!fileKey || typeof indexedDB === 'undefined') {
        alert('No se encontró el archivo adjunto en este navegador.');
        return;
    }

    try {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('fisio_admin_files_db', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const file = await new Promise((resolve, reject) => {
            const tx = db.transaction('reservation_files', 'readonly');
            const request = tx.objectStore('reservation_files').get(fileKey);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();

        if (!file || !file.blob) {
            alert('No se encontró el contenido del archivo adjunto.');
            return;
        }

        const url = window.URL.createObjectURL(file.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.original_name || 'archivo-adjunto';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error('Error al descargar archivo local:', error);
        alert('No se pudo descargar el archivo adjunto.');
    }
}

/**
 * Aprueba una reserva pendiente (PATCH /:id/status con status: "confirmed").
 */
async function approveReservation(id) {
    if (!id) {
        alert('ID de reserva no válido.');
        return;
    }

    const token = getAdminToken();
    const demoSession = sessionStorage.getItem(ADMIN_FRONTEND_SESSION_KEY);

    // En la sesión frontend de contingencia no existe JWT. Actualizamos la
    // copia local para que el portal siga siendo completamente funcional.
    if (!token && demoSession) {
        updateLocalReservationStatus(id, 'confirmed');
        return;
    }

    if (!token) {
        checkAdminAuth();
        return;
    }

    try {
        const response = await fetch(`${RESERVATION_CONFIG.API_BASE_URL}/reservations/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'confirmed' })
        });

        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            checkAdminAuth();
            return;
        }

        if (!response.ok) {
            throw new Error(`Error al aprobar (HTTP ${response.status})`);
        }

        loadAdminReservations();
    } catch (error) {
        console.error("Error al aprobar reserva:", error);
        alert('No se pudo aprobar la reserva. Verifica la conexión con el servidor.');
    }
}

/**
 * El backend no tiene un endpoint de borrado real (no existe DELETE
 * /reservations/:id) -solo PATCH /:id/status-, así que "eliminar" en
 * realidad cancela la reserva (transición de estado válida según
 * updateReservationStatusSchema).
 */
async function cancelReservation(id) {
    if (!id) {
        alert('ID de reserva no válido.');
        return;
    }

    pendingCancellationId = id;
    const modalElement = document.getElementById('cancelReservationModal');
    if (modalElement && typeof bootstrap !== 'undefined') {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
        return;
    }

    await confirmCancellation();
}

async function confirmCancellation() {
    const id = pendingCancellationId;
    pendingCancellationId = null;
    const modalElement = document.getElementById('cancelReservationModal');
    if (modalElement && typeof bootstrap !== 'undefined') {
        bootstrap.Modal.getOrCreateInstance(modalElement).hide();
    }
    if (!id) return;

    const token = getAdminToken();
    const demoSession = sessionStorage.getItem(ADMIN_FRONTEND_SESSION_KEY);

    // En la sesión frontend de contingencia no existe JWT. Actualizamos la
    // copia local para que el portal siga siendo completamente funcional.
    if (!token && demoSession) {
        updateLocalReservationStatus(id, 'cancelled');
        return;
    }

    if (!token) {
        checkAdminAuth();
        return;
    }

    try {
        const response = await fetch(`${RESERVATION_CONFIG.API_BASE_URL}/reservations/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'cancelled' })
        });

        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            checkAdminAuth();
            return;
        }

        if (!response.ok) {
            throw new Error(`Error al cancelar (HTTP ${response.status})`);
        }

        loadAdminReservations();
    } catch (error) {
        console.error("Error al cancelar reserva:", error);
        alert('No se pudo cancelar la reserva. Verifica la conexión con el servidor.');
    }
}

function updateLocalReservationStatus(id, status) {
    try {
        const reservations = getLocalReservations();
        const reservation = reservations.find((item) => String(item.id) === String(id));
        if (!reservation) {
            alert('La reserva no está disponible en el almacenamiento local de este navegador.');
            return;
        }

        reservation.status = status;
        reservation.updated_at = new Date().toISOString();
        localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(reservations));
        loadAdminReservations();
    } catch (error) {
        console.error('No se pudo actualizar el estado local de la reserva:', error);
        alert('No se pudo actualizar la reserva.');
    }
}

function exportReservationsCSV() {
    const reservations = getFilteredReservations();
    if (reservations.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const headers = ['ID', 'Paciente', 'Correo', 'Telefono', 'Servicio', 'Fecha y hora', 'Estado'];
    const rows = reservations.map((res) => [
        res.id || '',
        res.client_name || res.fullName || '',
        res.client_email || res.email || '',
        res.client_phone || res.phone || '',
        res.service_name || 'Servicio',
        res.start_time ? formatDateTime(res.start_time) : '',
        getStatusLabel(res.status)
    ]);
    const csvContent = `\uFEFF${[headers, ...rows].map((row) => row.map(csvEscape).join(';')).join('\r\n')}`;
    const encodedUri = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reservas_fisioterapia_li.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
}

function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function getExportRows(reservations) {
    return reservations.map((res) => [
        res.id || '',
        res.client_name || res.fullName || '',
        res.client_email || res.email || '',
        res.client_phone || res.phone || '',
        res.service_name || 'Servicio',
        res.start_time ? formatDateTime(res.start_time) : '',
        getStatusLabel(res.status)
    ]);
}

function exportReservationsExcel() {
    const reservations = getFilteredReservations();
    if (reservations.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const headers = ['ID', 'Paciente', 'Correo', 'Telefono', 'Servicio', 'Fecha y hora', 'Estado'];
    const rows = getExportRows(reservations);
    const statusClass = {
        Pendiente: 'pending',
        Confirmada: 'confirmed',
        Cancelada: 'cancelled',
        Completada: 'completed'
    };
    const tableRows = rows.map((row) => `<tr>${row.map((value, index) => {
        const className = index === 6 ? ` class="status-${statusClass[value] || 'pending'}"` : '';
        return `<td${className}>${escapeHtml(value)}</td>`;
    }).join('')}</tr>`).join('');
    const workbook = `<html><head><meta charset="UTF-8"><style>
        body{font-family:Arial;color:#1e293b}h1{color:#0077b6;font-size:20px}p{color:#64748b}table{border-collapse:collapse;width:100%;font-size:11px}th{background:#0077b6;color:#fff;padding:10px;text-align:left;border:1px solid #005b8c}td{padding:8px;border:1px solid #dbe3ea}tr:nth-child(even){background:#f1f7fa}.status-pending{background:#fff3cd;color:#856404;font-weight:bold}.status-confirmed{background:#d1e7dd;color:#0f5132;font-weight:bold}.status-cancelled{background:#f8d7da;color:#842029;font-weight:bold}.status-completed{background:#e2e3e5;color:#41464b;font-weight:bold}
    </style></head><body><h1>La Fisioterapeuta Li - Reservas</h1><p>Reporte generado el ${escapeHtml(new Date().toLocaleString('es-CO'))} | ${reservations.length} reservas</p><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reservas_fisioterapia_li.xls';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function getStatusLabel(status) {
    return { pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Completada' }[status] || status || 'Pendiente';
}

function getFilteredReservations() {
    const search = (document.getElementById('reservationSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('reservationStatusFilter')?.value || '';
    const date = document.getElementById('reservationDateFilter')?.value || '';
    return cachedReservations.filter((res) => {
        const text = `${res.client_name || res.fullName || ''} ${res.client_email || res.email || ''} ${res.service_name || ''} ${res.client_phone || res.phone || ''}`.toLowerCase();
        const resDate = res.start_time ? new Date(res.start_time).toISOString().slice(0, 10) : '';
        return (!search || text.includes(search)) && (!status || (res.status || 'pending') === status) && (!date || resDate === date);
    });
}

function exportReservationsPDF() {
    const reservations = getFilteredReservations();
    if (reservations.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const pdfApi = window.jspdf;
    if (!pdfApi || typeof pdfApi.jsPDF !== 'function' || typeof window.jspdf.jsPDF.API.autoTable !== 'function') {
        alert('No se pudo cargar el generador PDF. Revisa tu conexión y vuelve a intentarlo.');
        return;
    }

    const { jsPDF } = pdfApi;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(19);
    pdf.text('La Fisioterapeuta Li', 14, 16);
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Reporte administrativo de reservas', 14, 22);
    pdf.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 283, 16, { align: 'right' });
    pdf.text(`${reservations.length} reserva${reservations.length === 1 ? '' : 's'} incluida${reservations.length === 1 ? '' : 's'}`, 283, 22, { align: 'right' });
    pdf.setDrawColor(0, 119, 182);
    pdf.setLineWidth(1);
    pdf.line(14, 27, 283, 27);
    pdf.autoTable({
        startY: 33,
        head: [['ID', 'Paciente', 'Correo', 'Telefono', 'Servicio', 'Fecha y hora', 'Estado']],
        body: getExportRows(reservations),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59], lineColor: [219, 227, 234], lineWidth: 0.2 },
        headStyles: { fillColor: [0, 119, 182], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
                const colors = { Pendiente: [[255, 243, 205], [133, 100, 4]], Confirmada: [[209, 231, 221], [15, 81, 50]], Cancelada: [[248, 215, 218], [132, 32, 41]], Completada: [[226, 227, 229], [65, 70, 75]] };
                const color = colors[data.cell.raw];
                if (color) {
                    data.cell.styles.fillColor = color[0];
                    data.cell.styles.textColor = color[1];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });
    const pageCount = pdf.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`La Fisioterapeuta Li | Pagina ${page} de ${pageCount}`, 14, 202);
    }
    pdf.save('reservas_fisioterapia_li.pdf');
}

/**
 * Descarga un archivo adjunto (GET /api/files/:id/download, protegido).
 * Como la ruta exige el header Authorization, no sirve un <a href="...">
 * normal -el navegador no le agrega el token al navegar-; por eso se
 * pide con fetch() y se arma la descarga manualmente con un blob.
 */
async function downloadReservationFile(fileId) {
    const token = getAdminToken();
    if (!token) {
        checkAdminAuth();
        return;
    }

    try {
        const response = await fetch(`${RESERVATION_CONFIG.API_BASE_URL}/files/${fileId}/download`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            checkAdminAuth();
            return;
        }

        if (!response.ok) {
            throw new Error(`Error al descargar (HTTP ${response.status})`);
        }

        // El backend ya manda el nombre real del archivo en el header
        // Content-Disposition (ver res.download() en file.controller.js);
        // se recupera de ahí en vez de pasarlo por separado.
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = /filename[^;=\n]*=(?:UTF-8'')?["']?([^"';\n]+)["']?/i.exec(disposition);
        const filename = match ? decodeURIComponent(match[1]) : `archivo-${fileId}`;

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error al descargar archivo:', error);
        alert('No se pudo descargar el archivo. Verifica la conexión con el servidor.');
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('es-CO', {
        timeZone: 'UTC',
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}
