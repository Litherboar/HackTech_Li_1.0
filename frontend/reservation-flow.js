/**
 * reservation-flow.js
 * Maneja el flujo completo del formulario de reserva del modal:
 * carga de servicios, disponibilidad por servicio/fecha, selección de
 * horario, validación, carga de archivos adjuntos y envío al backend
 * o a los mocks.
 */

// --- AUTENTICACIÓN DE CLIENTES Y ADMIN ---
const ADMIN_EMAIL = 'admin@fisioterapeutali.com';
const ADMIN_PASSWORD = 'Admin12345';
const CLIENT_AUTH_TOKEN_KEY = 'client_auth_token';
const CLIENT_SESSION_KEY = 'fisio_client_session';
const REGISTERED_USERS_KEY = 'fisio_registered_users';
const ADMIN_FRONTEND_SESSION_KEY = 'fisio_admin_frontend_session';

let pendingServiceReservation = null;

function getStorageItem(storage, key) {
  try {
    return storage ? storage.getItem(key) : null;
  } catch (_) {
    return null;
  }
}

function setStorageItem(storage, key, value) {
  try {
    if (storage) storage.setItem(key, value);
  } catch (_) {
    // El navegador puede bloquear el almacenamiento; la sesión continúa en memoria.
  }
}

function removeStorageItem(storage, key) {
  try {
    if (storage) storage.removeItem(key);
  } catch (_) {
    // Ignorar errores de almacenamiento.
  }
}

function getRegisteredUsers() {
  try {
    const raw = getStorageItem(localStorage, REGISTERED_USERS_KEY);
    const users = raw ? JSON.parse(raw) : [];
    return Array.isArray(users) ? users : [];
  } catch (_) {
    return [];
  }
}

function saveRegisteredUsers(users) {
  setStorageItem(localStorage, REGISTERED_USERS_KEY, JSON.stringify(users));
}

async function hashClientPassword(password) {
  const value = String(password || '');

  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  // Respaldo para entornos que no exponen Web Crypto.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}

function openAuthModal() {
  const authModalEl = document.getElementById('userAuthModal');
  if (!authModalEl || typeof bootstrap === 'undefined') return;

  const authModal = bootstrap.Modal.getInstance(authModalEl) || new bootstrap.Modal(authModalEl);
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginAuthError');
  const registerError = document.getElementById('registerAuthError');
  if (loginEmail) loginEmail.value = '';
  if (loginPassword) loginPassword.value = '';
  if (loginError) loginError.style.display = 'none';
  if (registerError) registerError.style.display = 'none';
  authModal.show();
}

window.checkUserAuthAndReserve = function(serviceName = null) {
  const clientToken = getStorageItem(sessionStorage, CLIENT_AUTH_TOKEN_KEY);
  const clientSession = getStorageItem(sessionStorage, CLIENT_SESSION_KEY);

  if (clientToken || clientSession) {
    openReservationModal(serviceName);
    return;
  }

  pendingServiceReservation = serviceName;
  openAuthModal();
};

/**
 * Actualiza la visibilidad del botón de cierre de sesión del sitio público.
 * La sesión se considera activa si existe una sesión/token de cliente o la
 * sesión administrativa frontend que puede utilizar el prototipo.
 */
window.updateUserAuthUI = function() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  const clientToken = getStorageItem(sessionStorage, CLIENT_AUTH_TOKEN_KEY);
  const clientSession = getStorageItem(sessionStorage, CLIENT_SESSION_KEY);
  const adminToken = getStorageItem(sessionStorage, 'fisio_admin_token');
  const adminSession = getStorageItem(sessionStorage, ADMIN_FRONTEND_SESSION_KEY);
  const isAuthenticated = Boolean(clientToken || clientSession || adminToken || adminSession);

  logoutBtn.classList.toggle('d-none', !isAuthenticated);
};

/**
 * Cierra cualquier sesión iniciada desde el sitio público sin borrar la cuenta
 * registrada ni las reservas/documentos guardados. Después de cerrar sesión,
 * el usuario permanece en el sitio y puede volver a iniciar sesión cuando
 * quiera.
 */
window.handleUserLogout = function() {
  removeStorageItem(sessionStorage, CLIENT_AUTH_TOKEN_KEY);
  removeStorageItem(sessionStorage, CLIENT_SESSION_KEY);
  removeStorageItem(sessionStorage, 'fisio_admin_token');
  removeStorageItem(sessionStorage, ADMIN_FRONTEND_SESSION_KEY);

  pendingServiceReservation = null;

  const modalBackdrop = document.getElementById('modalBackdrop');
  if (modalBackdrop) {
    modalBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  const authModalEl = document.getElementById('userAuthModal');
  if (authModalEl && typeof bootstrap !== 'undefined') {
    const authModal = bootstrap.Modal.getInstance(authModalEl);
    if (authModal) authModal.hide();
  }

  resetReservationForm();
  updateUserAuthUI();

  // Feedback breve y no intrusivo para confirmar la acción.
  const existingToast = document.getElementById('logoutFeedback');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.id = 'logoutFeedback';
  toast.className = 'position-fixed bottom-0 start-50 translate-middle-x mb-4 alert alert-success shadow-sm rounded-pill px-4 py-2';
  toast.style.zIndex = '1100';
  toast.innerHTML = '<i class="fa-solid fa-circle-check me-2"></i>Sesión cerrada correctamente.';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
};

window.handleUserLogin = async function(event) {
  event.preventDefault();

  const errorEl = document.getElementById('loginAuthError');
  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : 'Ingresar y Continuar';
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  if (errorEl) errorEl.style.display = 'none';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Ingresando...';
  }

  try {
    if (!email || !password) {
      throw new Error('Ingresa tu correo y contraseña.');
    }

    // Credenciales administrativas solicitadas para la demo de la hackathon.
    // Primero intentamos autenticarlas contra el backend; si esa cuenta todavía
    // no existe en la BD, mantenemos un acceso frontend de contingencia para el prototipo.
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      let backendToken = null;

      try {
        const response = await apiUserLogin({ email, password });
        backendToken = response.data?.token || null;
      } catch (backendError) {
        console.warn('No fue posible validar el admin contra el backend. Se usará sesión frontend de demo.', backendError);
      }

      if (backendToken) {
        setStorageItem(sessionStorage, 'fisio_admin_token', backendToken);
        removeStorageItem(sessionStorage, ADMIN_FRONTEND_SESSION_KEY);
      } else {
        setStorageItem(sessionStorage, ADMIN_FRONTEND_SESSION_KEY, JSON.stringify({
          email,
          role: 'admin',
          demo: true
        }));
      }

      window.location.href = 'admin.html';
      return;
    }

    // Usuarios registrados desde este frontend.
    const users = getRegisteredUsers();
    const localUser = users.find((user) => user.email === email);

    if (localUser) {
      const passwordHash = await hashClientPassword(password);
      if (passwordHash !== localUser.passwordHash) {
        throw new Error('Correo o contraseña incorrectos.');
      }

      setStorageItem(sessionStorage, CLIENT_SESSION_KEY, JSON.stringify({
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        phone: localUser.phone
      }));
      removeStorageItem(sessionStorage, CLIENT_AUTH_TOKEN_KEY);

      fillReservationUser(localUser);
      closeAuthModalAndOpenReservation();
      updateUserAuthUI();
      event.target.reset();
      return;
    }

    // Compatibilidad con usuarios que ya existan en el backend.
    const response = await apiUserLogin({ email, password });
    const backendUser = response.data?.user;
    if (!backendUser || !response.data?.token) {
      throw new Error('La respuesta de autenticación no es válida.');
    }

    setStorageItem(sessionStorage, CLIENT_AUTH_TOKEN_KEY, response.data.token);
    setStorageItem(sessionStorage, CLIENT_SESSION_KEY, JSON.stringify({
      id: backendUser.id,
      name: backendUser.name || '',
      email: backendUser.email,
      phone: backendUser.phone || ''
    }));

    fillReservationUser({
      name: backendUser.name || '',
      email: backendUser.email || email,
      phone: backendUser.phone || ''
    });

    closeAuthModalAndOpenReservation();
    updateUserAuthUI();
    event.target.reset();
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = describeApiError(error, 'Credenciales incorrectas o error en el servidor.');
      errorEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
};

window.handleUserRegister = async function(event) {
  event.preventDefault();

  const errorEl = document.getElementById('registerAuthError');
  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : 'Registrarme y Continuar';

  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;

  if (errorEl) errorEl.style.display = 'none';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';
  }

  try {
    if (name.length < 2 || name.length > 120) {
      throw new Error('El nombre debe tener entre 2 y 120 caracteres.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Ingresa un correo electrónico válido.');
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 30) {
      throw new Error('Ingresa un teléfono válido (mínimo 7 dígitos).');
    }

    if (password.length < 8 || password.length > 72) {
      throw new Error('La contraseña debe tener entre 8 y 72 caracteres.');
    }

    if (email === ADMIN_EMAIL) {
      throw new Error('Ese correo está reservado para la cuenta administrativa.');
    }

    const users = getRegisteredUsers();
    if (users.some((user) => user.email === email)) {
      throw new Error('Ese correo ya está registrado. Inicia sesión con tu cuenta.');
    }

    // El backend actual está diseñado para usuarios administrativos y su
    // esquema usa `name` (no `fullName`). El sitio web mantiene las cuentas
    // de clientes en localStorage para no alterar ningún archivo backend.
    // La contraseña se almacena como hash, no como texto plano.
    const passwordHash = await hashClientPassword(password);
    const user = {
      id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      email,
      phone,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveRegisteredUsers(users);

    setStorageItem(sessionStorage, CLIENT_SESSION_KEY, JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone
    }));
    removeStorageItem(sessionStorage, CLIENT_AUTH_TOKEN_KEY);

    fillReservationUser(user);
    closeAuthModalAndOpenReservation();
    updateUserAuthUI();
    event.target.reset();
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'No se pudo crear la cuenta.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
};

function fillReservationUser(user) {
  const name = document.getElementById('resName');
  const email = document.getElementById('resEmail');
  const phone = document.getElementById('resPhone');
  if (name) name.value = user.name || user.fullName || '';
  if (email) email.value = user.email || '';
  if (phone) phone.value = user.phone || '';
}

function closeAuthModalAndOpenReservation() {
  const authModalEl = document.getElementById('userAuthModal');
  const authModal = authModalEl && typeof bootstrap !== 'undefined'
    ? bootstrap.Modal.getInstance(authModalEl)
    : null;

  if (authModal) authModal.hide();

  setTimeout(() => {
    openReservationModal(pendingServiceReservation);
    pendingServiceReservation = null;
  }, 350);
}

// --------------------------------------------------------

const reservationState = {
  services: [],
  servicesLoaded: false,
  selectedServiceId: null,
  selectedDate: null,
  availableSlots: [],
  selectedSlot: null,
  submitting: false
};

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('resDate');
  const serviceSelect = document.getElementById('resService');
  const form = document.getElementById('reservationForm');

  if (dateInput) {
    dateInput.min = todayAsInputValue();
  }

  if (serviceSelect) {
    serviceSelect.addEventListener('change', onServiceOrDateChange);
  }

  if (dateInput) {
    dateInput.addEventListener('change', onServiceOrDateChange);
  }

  if (form) {
    form.addEventListener('submit', onSubmitReservation);
  }

  ensureFileInputEl();
  loadServices();
});

// Hook que app.js llama al abrir el modal (showModal), para precargar
// servicios y preseleccionar el servicio elegido desde una tarjeta.
window.onReservationModalOpen = async function onReservationModalOpen(serviceName) {
  clearFeedback();
  resetSlotSelection();

  if (!reservationState.servicesLoaded) {
    await loadServices();
  }

  if (serviceName) {
    const match = reservationState.services.find((s) => s.name === serviceName);
    const serviceSelect = document.getElementById('resService');
    if (match && serviceSelect) {
      serviceSelect.value = String(match.id);
      reservationState.selectedServiceId = match.id;
      onServiceOrDateChange();
    }
  }
};

async function loadServices() {
  const serviceSelect = document.getElementById('resService');
  if (!serviceSelect) return;

  setSelectLoading(serviceSelect, 'Cargando servicios...');

  try {
    const response = await apiGetServices();
    reservationState.services = response.data || [];
    reservationState.servicesLoaded = true;
    renderServiceOptions(reservationState.services);
  } catch (error) {
    showFeedback('error', 'No se pudieron cargar los servicios. Intenta de nuevo más tarde.');
    serviceSelect.innerHTML = '<option value="">No disponible</option>';
  }
}

function renderServiceOptions(services) {
  const serviceSelect = document.getElementById('resService');
  if (!serviceSelect) return;

  const options = ['<option value="">Seleccione un servicio...</option>']
    .concat(
      services.map(
        (s) => `<option value="${s.id}">${s.name} (${s.duration_minutes} min)</option>`
      )
    );

  serviceSelect.innerHTML = options.join('');
}

async function onServiceOrDateChange() {
  const serviceSelect = document.getElementById('resService');
  const dateInput = document.getElementById('resDate');

  reservationState.selectedServiceId = serviceSelect.value || null;
  reservationState.selectedDate = dateInput.value || null;
  resetSlotSelection();

  if (!reservationState.selectedServiceId || !reservationState.selectedDate) {
    renderSlotsHint('Selecciona un servicio y una fecha para ver horarios.');
    return;
  }

  await loadAvailability();
}

async function loadAvailability() {
  renderSlotsHint('Buscando horarios disponibles...');

  try {
    const response = await apiGetAvailability({
      serviceId: reservationState.selectedServiceId,
      date: reservationState.selectedDate
    });

    const rawSlots = (response.data && response.data.slots) || [];

    // The API returns UTC slots; booking hours are displayed in Colombia time.
    reservationState.availableSlots = rawSlots.filter(slot => {
      const slotDate = new Date(slot.startTime);
      const endDate = new Date(slot.endTime);
      const startParts = getBogotaDateParts(slotDate);
      const endParts = getBogotaDateParts(endDate);
      const localDate = `${startParts.year}-${startParts.month}-${startParts.day}`;
      const hour = Number(startParts.hour);
      const endHour = Number(endParts.hour);
      const lunchOverlap = hour < 14 && endHour > 12;
      return localDate === reservationState.selectedDate
        && hour >= 7
        && endHour <= 20
        && !lunchOverlap;
    });

    renderTimeSlots(reservationState.availableSlots);
  } catch (error) {
    reservationState.availableSlots = [];
    renderSlotsHint(describeApiError(error, 'No se pudo consultar la disponibilidad.'));
  }
}

function renderSlotsHint(message) {
  const container = document.getElementById('resTimeSlots');
  if (container) {
    container.innerHTML = `<p class="slots-hint">${message}</p>`;
  }
}

function renderTimeSlots(slots) {
  const container = document.getElementById('resTimeSlots');
  if (!container) return;

  if (!slots.length) {
    container.innerHTML = '<p class="slots-hint">No hay horarios disponibles para esa fecha. Prueba otro día.</p>';
    return;
  }

  container.innerHTML = slots
    .map((slot, index) => {
      const label = formatTimeLabel(slot.startTime);
      return `<button type="button" class="slot-btn" data-slot-index="${index}">${label}</button>`;
    })
    .join('');

  container.querySelectorAll('.slot-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectSlot(Number(btn.dataset.slotIndex)));
  });
}

function selectSlot(index) {
  const slot = reservationState.availableSlots[index];
  if (!slot) return;

  reservationState.selectedSlot = slot;
  document.getElementById('resStartTime').value = slot.startTime;
  document.getElementById('resEndTime').value = slot.endTime;

  document.querySelectorAll('.slot-btn').forEach((btn, i) => {
    btn.classList.toggle('slot-btn-selected', i === index);
  });

  clearFieldError('time');
}

function resetSlotSelection() {
  reservationState.selectedSlot = null;
  reservationState.availableSlots = [];
  const startInput = document.getElementById('resStartTime');
  const endInput = document.getElementById('resEndTime');
  if (startInput) startInput.value = '';
  if (endInput) endInput.value = '';
}

async function onSubmitReservation(event) {
  event.preventDefault();
  if (reservationState.submitting) return;

  clearFeedback();
  clearAllFieldErrors();

  const notesEl = document.getElementById('resNotes');
  const filesEl = document.getElementById('resFile');

  const formData = {
    serviceId: reservationState.selectedServiceId,
    date: reservationState.selectedDate,
    startTime: reservationState.selectedSlot ? reservationState.selectedSlot.startTime : '',
    fullName: document.getElementById('resName').value,
    email: document.getElementById('resEmail').value,
    phone: document.getElementById('resPhone').value,
    notes: notesEl ? notesEl.value : ''
  };

  const { isValid, errors } = validateReservationForm(formData);
  const filesResult = validateFiles(filesEl ? filesEl.files : null);
  const allErrors = { ...errors, ...filesResult.errors };

  if (!isValid || !filesResult.isValid) {
    showFieldErrors(allErrors);
    showFeedback('error', 'Revisa los campos marcados antes de continuar.');
    return;
  }

  setSubmitting(true);

  try {
    const payload = {
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      serviceId: Number(formData.serviceId),
      startTime: reservationState.selectedSlot.startTime,
      endTime: reservationState.selectedSlot.endTime,
      notes: formData.notes ? formData.notes.trim() : undefined
    };

    const response = await apiCreateReservation(payload);
    const { reservation, service } = response.data;
    const selectedFiles = filesEl && filesEl.files ? Array.from(filesEl.files) : [];
    saveLocalReservationForAdmin({
      reservation,
      service,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      files: selectedFiles
    });

    // Guardamos el contenido local antes de intentar la subida al backend.
    // Así el panel administrativo frontend puede mostrar el archivo y
    // permitir descargarlo incluso durante una caída temporal del backend.
    if (selectedFiles.length > 0) {
      await saveReservationFilesLocally(reservation.id, selectedFiles);
    }

    let successMessage = `Reserva confirmada para "${service.name}" el ${formatDateTimeLabel(reservation.start_time)}. Te enviaremos la confirmación por correo.`;

    if (filesEl && filesEl.files && filesEl.files.length > 0) {
      try {
        const uploadedFiles = await apiUploadReservationFiles({
          reservationId: reservation.id,
          email: payload.email,
          files: filesEl.files
        });

        // Conservamos una copia local de los archivos para el portal admin
        // frontend. Esto permite visualizarlos/descargarlos incluso cuando
        // el portal está funcionando en modo de contingencia sin JWT.
        await saveReservationFilesLocally(reservation.id, filesEl.files, uploadedFiles?.data || []);
        updateLocalReservationFiles(reservation.id, uploadedFiles?.data || Array.from(filesEl.files).map((file) => ({
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size
        })));

        successMessage += ' Tus archivos adjuntos se subieron correctamente.';
      } catch (uploadError) {
        successMessage += ` Sin embargo, no se pudieron subir los archivos adjuntos (${describeApiError(uploadError, 'error desconocido')}). Puedes intentar reenviarlos más tarde.`;
      }
    }

    showFeedback('success', successMessage);
    resetSlotSelection();
    window.dispatchEvent(new CustomEvent('reservationSuccess', { detail: { reservation, service } }));
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR' && error.details) {
      showFeedback('error', 'El backend rechazó algunos datos del formulario. Revisa la información.');
    } else {
      showFeedback('error', describeApiError(error, 'No se pudo completar la reserva.'));
    }

    if (error.code === 'SLOT_UNAVAILABLE') {
      resetSlotSelection();
      loadAvailability();
    }
  } finally {
    setSubmitting(false);
  }
}



const LOCAL_FILES_DB_NAME = 'fisio_admin_files_db';
const LOCAL_FILES_STORE = 'reservation_files';

function openLocalFilesDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }

    const request = indexedDB.open(LOCAL_FILES_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_FILES_STORE)) {
        const store = db.createObjectStore(LOCAL_FILES_STORE, { keyPath: 'key' });
        store.createIndex('reservationId', 'reservationId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local de archivos.'));
  });
}

async function saveReservationFilesLocally(reservationId, files, uploadedMetadata = []) {
  if (!files || !files.length) return;

  try {
    const db = await openLocalFilesDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_FILES_STORE, 'readwrite');
      const store = tx.objectStore(LOCAL_FILES_STORE);

      Array.from(files).forEach((file, index) => {
        const serverMeta = uploadedMetadata[index] || {};
        store.put({
          key: `${reservationId}-${index}-${file.name}`,
          reservationId: String(reservationId),
          index,
          original_name: serverMeta.original_name || file.name,
          mime_type: serverMeta.mime_type || file.type || 'application/octet-stream',
          size_bytes: serverMeta.size_bytes || file.size || 0,
          blob: file
        });
      });

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('No se pudieron guardar los archivos localmente.'));
      tx.onabort = () => reject(tx.error || new Error('No se pudieron guardar los archivos localmente.'));
    });
    db.close();
  } catch (error) {
    // El archivo ya fue enviado al backend; si IndexedDB no está disponible,
    // no debemos convertir una reserva exitosa en una reserva fallida.
    console.warn('No se pudo crear la copia local del archivo adjunto:', error);
  }
}

function updateLocalReservationFiles(reservationId, filesMetadata) {
  try {
    const raw = localStorage.getItem('fisio_local_reservations');
    const reservations = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(reservations)) return;

    const reservation = reservations.find((item) => String(item.id) === String(reservationId));
    if (!reservation) return;

    reservation.files = Array.isArray(filesMetadata)
      ? filesMetadata.map((file, index) => ({
          ...file,
          localIndex: index
        }))
      : [];

    localStorage.setItem('fisio_local_reservations', JSON.stringify(reservations));
  } catch (error) {
    console.warn('No se pudo actualizar la información local de archivos:', error);
  }
}

function saveLocalReservationForAdmin({ reservation, service, fullName, email, phone, files = [] }) {
  try {
    const raw = localStorage.getItem('fisio_local_reservations');
    const reservations = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(reservations) ? reservations : [];

    const entry = {
      id: reservation?.id || `local-${Date.now()}`,
      client_name: fullName,
      client_email: email,
      client_phone: phone,
      service_name: service?.name || 'Servicio',
      service_id: service?.id || reservation?.service_id,
      start_time: reservation?.start_time || null,
      end_time: reservation?.end_time || null,
      status: reservation?.status || 'pending',
      notes: reservation?.notes || null,
      created_at: reservation?.created_at || new Date().toISOString(),
      files: Array.from(files || []).map((file, index) => ({
        original_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size || 0,
        localIndex: index
      }))
    };

    const existingIndex = list.findIndex((item) => String(item.id) === String(entry.id));
    if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...entry };
    else list.push(entry);

    localStorage.setItem('fisio_local_reservations', JSON.stringify(list));
  } catch (error) {
    console.warn('No se pudo guardar la reserva en el historial local del frontend.', error);
  }
}

function describeApiError(error, fallbackMessage) {
  const knownMessages = {
    SLOT_UNAVAILABLE: 'Ese horario ya no está disponible. Elige otro.',
    SERVICE_NOT_FOUND: 'El servicio seleccionado ya no existe o no está activo.',
    INVALID_TIME_RANGE: 'El rango de horario seleccionado no es válido.',
    RANGE_TOO_LARGE: 'El rango de fechas consultado es demasiado amplio.',
    VALIDATION_ERROR: 'Alguno de los datos ingresados no es válido.',
    UNSUPPORTED_FILE_TYPE: 'Uno de los archivos no tiene un formato permitido.',
    INVALID_FILE_UPLOAD: 'Faltan datos para subir el archivo.',
    FILE_UPLOAD_LIMIT_EXCEEDED: 'Uno de los archivos excede el límite permitido.',
    RESERVATION_NOT_FOUND: 'No se encontró la reserva para adjuntar el archivo.',
    EMAIL_MISMATCH: 'El correo no coincide con el de la reserva.'
  };

  if (error && error.code && knownMessages[error.code]) {
    return knownMessages[error.code];
  }

  if (error && error.status === 0) {
    return 'No hay conexión con el servidor. Verifica tu red o inténtalo más tarde.';
  }

  return (error && error.message) || fallbackMessage;
}

function setSubmitting(isSubmitting) {
  reservationState.submitting = isSubmitting;

  if (typeof window.toggleLoadingState === 'function') {
    window.toggleLoadingState(isSubmitting);
    return;
  }

  const btn = document.getElementById('resSubmitBtn');
  if (!btn) return;

  btn.disabled = isSubmitting;

  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');
  if (btnText && btnLoader) {
    btnText.textContent = isSubmitting ? 'Enviando...' : 'Confirmar Reserva';
    btnLoader.classList.toggle('d-none', !isSubmitting);
  } else {
    btn.textContent = isSubmitting ? 'Enviando...' : 'Confirmar Reserva';
  }
}

function setSelectLoading(selectEl, label) {
  selectEl.innerHTML = `<option value="">${label}</option>`;
}

function showFeedback(type, message) {
  const el = document.getElementById('resFeedback');
  if (!el) return;
  el.textContent = message;
  el.className = `reservation-feedback reservation-feedback-${type}`;
  el.style.display = 'block';

  // Respaldo directo: app.js ya oculta #formFooter al escuchar
  // 'reservationSuccess', pero lo hacemos también aquí mismo -sin
  // depender de que ese evento llegue a tiempo- para garantizar que los
  // botones de Cancelar/Confirmar no queden visibles junto al mensaje
  // de éxito.
  const footer = document.getElementById('formFooter');
  if (footer && type === 'success') {
    footer.classList.remove('d-flex');
    footer.classList.add('d-none');
  }
}

function clearFeedback() {
  const el = document.getElementById('resFeedback');
  if (!el) return;
  el.textContent = '';
  el.className = 'reservation-feedback';
  el.style.display = 'none';

  // Vuelve a mostrar los botones para un nuevo intento (se llama al
  // abrir el modal y al inicio de cada envío).
  const footer = document.getElementById('formFooter');
  if (footer) {
    footer.classList.remove('d-none');
    footer.classList.add('d-flex');
  }
}

const FIELD_INPUT_IDS = {
  fullName: 'resName',
  email: 'resEmail',
  phone: 'resPhone',
  notes: 'resNotes',
  files: 'resFile'
};

function ensureFieldErrorEl(field) {
  let el = document.getElementById(`error-${field}`);
  if (el) return el;

  const inputId = FIELD_INPUT_IDS[field];
  const input = inputId ? document.getElementById(inputId) : null;
  if (!input) return null;

  el = document.createElement('span');
  el.id = `error-${field}`;
  el.className = 'text-danger small mt-1 d-block';
  input.insertAdjacentElement('afterend', el);
  return el;
}

function ensureFileInputEl() {
  if (document.getElementById('resFile')) return;

  const phoneField = document.getElementById('resPhone');
  if (!phoneField) return;
  const phoneGroup = phoneField.closest('.mb-3') || phoneField;

  const wrapper = document.createElement('div');
  wrapper.className = 'mb-3';
  wrapper.innerHTML = `
    <label for="resFile" class="form-label fw-semibold text-dark">Adjuntar documentos (opcional)</label>
    <input type="file" id="resFile" name="archivos" class="form-control shadow-none" multiple
           accept=".pdf,.jpg,.jpeg,.png,.webp,.docx">
    <small class="text-secondary d-block mt-1">PDF, JPG, PNG, WEBP o DOCX. Máximo 5 archivos, 10MB cada uno.</small>
    <span class="text-danger small mt-1 d-block" id="error-files"></span>
  `;

  phoneGroup.insertAdjacentElement('afterend', wrapper);
}

function showFieldErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const el = document.getElementById(`error-${field}`) || ensureFieldErrorEl(field);
    if (el) el.textContent = message;
  });
}

function clearFieldError(field) {
  const el = document.getElementById(`error-${field}`);
  if (el) el.textContent = '';
}

function clearAllFieldErrors() {
  ['service', 'date', 'time', 'fullName', 'email', 'phone', 'notes', 'files'].forEach(clearFieldError);
}

function todayAsInputValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeLabel(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTimeLabel(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function getBogotaDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(parts
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
}