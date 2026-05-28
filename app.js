/* ==========================================================================
   LÓGICA CENTRAL DE LA APLICACIÓN - COLEGIO SAN NICOLÁS DE MIRA
   Controlador del Módulo de Marcado, Calendario Académico y Motor de Alertas
   ========================================================================== */

// 1. CONFIGURACIÓN Y PROGRAMACIÓN ESCOLAR POR DEFECTO
const DEFAULT_CALENDAR = [
    { name: "Entrada y Registro Matinal", type: "clase", start: "08:00", end: "08:30" },
    { name: "Bloque 1: Clases Lectivas", type: "clase", start: "08:30", end: "10:00" },
    { name: "Recreo de la Mañana (Primer Recreo)", type: "recreo", start: "10:00", end: "10:30" },
    { name: "Bloque 2: Clases Lectivas", type: "clase", start: "10:30", end: "12:00" },
    { name: "Recreo de Colación (Segundo Recreo)", type: "recreo", start: "12:00", end: "12:20" },
    { name: "Bloque 3: Clases Lectivas", type: "clase", start: "12:20", end: "13:40" },
    { name: "Almuerzo y Recreo Largo", type: "recreo", start: "13:40", end: "14:30" },
    { name: "Bloque 4: Talleres y Deportes", type: "clase", start: "14:30", end: "16:00" },
    { name: "Despido Escolar y Salida", type: "clase", start: "16:00", end: "16:30" },
    { name: "Bloque de Aseo Profundo / Tarde", type: "clase", start: "16:30", end: "18:00" }
];

// Nombres exactos solicitados para las canchas
const SPECIAL_ZONES = [
    "Cancha Central",
    "Cancha de Básquetbol",
    "Cancha de Fútbol"
];

// ESTADO GLOBAL DE LA APLICACIÓN
let appState = {
    zones: [],         // Timestamps y estados de aseo
    calendar: [],      // Programación diaria activa
    isSimulatorOn: false,
    simulatedMinutes: 676, // Inicialmente 11:16 AM en minutos desde las 00:00
    activeTab: "tab-marking"
};

// 2. INICIALIZADOR DEL SISTEMA
document.addEventListener("DOMContentLoaded", () => {
    initData();
    setupEventListeners();
    startLiveClock();
    renderAll();
});

// 3. ADMINISTRACIÓN DE DATOS (LOCALSTORAGE)
function initData() {
    // Inicializar Calendario
    const savedCalendar = localStorage.getItem("san_nicolas_calendar");
    if (savedCalendar) {
        appState.calendar = JSON.parse(savedCalendar);
    } else {
        appState.calendar = [...DEFAULT_CALENDAR];
        localStorage.setItem("san_nicolas_calendar", JSON.stringify(appState.calendar));
    }

    // Inicializar Zonas de Aseo (33 casillas: 30 salas + 3 canchas exactas)
    const savedAseos = localStorage.getItem("san_nicolas_aseos");
    if (savedAseos) {
        appState.zones = JSON.parse(savedAseos);
        
        // Sanity Check: Asegurar que hay exactamente 33 zonas por si cambió la lógica
        if (appState.zones.length !== 33) {
            buildNewZonesState();
        }
    } else {
        buildNewZonesState();
    }
}

function buildNewZonesState() {
    appState.zones = [];
    
    // Generar 30 Salas numeradas
    for (let i = 1; i <= 30; i++) {
        appState.zones.push({
            id: `sala-${i}`,
            name: `Sala ${i}`,
            type: "sala",
            lastClean: null
        });
    }

    // Generar 3 Canchas con sus nombres exactos
    SPECIAL_ZONES.forEach((canchaName, index) => {
        appState.zones.push({
            id: `cancha-${index + 1}`,
            name: canchaName,
            type: "cancha",
            lastClean: null
        });
    });

    saveAseosToStorage();
}

function saveAseosToStorage() {
    localStorage.setItem("san_nicolas_aseos", JSON.stringify(appState.zones));
}

function saveCalendarToStorage() {
    localStorage.setItem("san_nicolas_calendar", JSON.stringify(appState.calendar));
}

// 4. MOTOR DE OPTIMIZACIÓN Y ALERTAS
// Recibe un string de hora en formato "HH:MM" y retorna el análisis de optimización
function getOptimizationStatus(timeStr) {
    const currentMins = timeStringToMinutes(timeStr);
    
    // Encontrar bloque actual
    let currentBlock = appState.calendar.find(b => {
        const startMins = timeStringToMinutes(b.start);
        const endMins = timeStringToMinutes(b.end);
        return currentMins >= startMins && currentMins < endMins;
    });

    // Encontrar el siguiente bloque relevante (especialmente recreos y eventos)
    let nextBlocks = appState.calendar
        .filter(b => timeStringToMinutes(b.start) > currentMins)
        .sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
    
    let nextBlock = nextBlocks[0] || null;
    let nextConflictBlock = nextBlocks.find(b => b.type === "recreo" || b.type === "evento") || null;

    // Horarios fuera de rango escolar (antes de las 8 AM o después de las 6 PM)
    if (!currentBlock) {
        if (currentMins >= 1080 || currentMins < 480) { // Después de las 18:00 o antes de las 08:00
            return {
                rating: "success", // Verde
                label: "Óptimo",
                title: "Ventana de Aseo General",
                text: "La jornada escolar regular no está activa. Excelente momento para realizar aseo profundo en salas y canchas sin interrupciones.",
                currentBlockName: "Fuera de Jornada Escolar",
                currentBlockTime: "18:00 - 08:00 hrs",
                currentBlockType: "libre",
                conflictZoneWarning: false,
                minutesToConflict: null,
                nextConflictName: ""
            };
        } else {
            // Un bloque libre durante la jornada
            currentBlock = { name: "Bloque Libre / Ventana", type: "libre", start: "08:00", end: "18:00" };
        }
    }

    // 1. CASO: RECREO O EVENTO EN CURSO (Alerta roja/peligro)
    if (currentBlock.type === "recreo" || currentBlock.type === "evento") {
        return {
            rating: "danger", // Rojo
            label: "Evitar",
            title: "Tránsito Activo en Progreso",
            text: `Hay un ${currentBlock.type === "recreo" ? "recreo" : "evento masivo"} en curso ("${currentBlock.name}"). Evitar limpiar ya que las zonas de alto tránsito se ensuciarán inmediatamente. Se sugiere postergar la limpieza hasta que los alumnos vuelvan a clases.`,
            currentBlockName: currentBlock.name,
            currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
            currentBlockType: currentBlock.type,
            conflictZoneWarning: true, // Avisa de evitar limpieza
            minutesToConflict: 0,
            nextConflictName: currentBlock.name
        };
    }

    // 2. CASO: PRE-CONFLICTO (Recreo o Evento se aproxima en los próximos 30 minutos)
    if (nextConflictBlock) {
        const nextConflictStart = timeStringToMinutes(nextConflictBlock.start);
        const diffMinutes = nextConflictStart - currentMins;

        if (diffMinutes <= 30) {
            return {
                rating: "warning", // Naranja
                label: "Postponer",
                title: "¡Conflicto Próximo!",
                text: `El bloque "${nextConflictBlock.name}" comenzará en ${diffMinutes} minutos (a las ${nextConflictBlock.start} hrs). Si limpia salas ahora, el esfuerzo se perderá debido al alto flujo inminente de estudiantes. Se sugiere esperar y limpiar después del recreo.`,
                currentBlockName: currentBlock.name,
                currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
                currentBlockType: currentBlock.type,
                conflictZoneWarning: true, // Avisa de evitar limpieza
                minutesToConflict: diffMinutes,
                nextConflictName: nextConflictBlock.name
            };
        }
    }

    // 3. CASO: CLASE LECTIVA ACTIVA (Y no hay recreo en los próximos 30 minutos)
    return {
        rating: "success", // Verde
        label: "Óptimo",
        title: "Excelente momento para limpiar",
        text: `Los alumnos se encuentran en clases (${currentBlock.name}) y no hay recreos próximos en los siguientes 30 minutos. Limpiar ahora garantiza que el aseo dure y se mantenga en excelentes condiciones.`,
        currentBlockName: currentBlock.name,
        currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
        currentBlockType: currentBlock.type,
        conflictZoneWarning: false,
        minutesToConflict: null,
        nextConflictName: ""
    };
}

// 5. INTERFAZ Y RENDERIZADO DINÁMICO
function renderAll() {
    const timeStr = getCurrentTimeFormatted();
    const optStatus = getOptimizationStatus(timeStr);
    
    renderGlobalAlertBanner(optStatus);
    renderMarkingPanel(optStatus);
    renderOptimizationDashboard(optStatus);
    renderCalendarBlocksTable();
    updateGlobalUIPills(optStatus);
    updateQuickStats();
}

// Actualiza los badges del header principal
function updateGlobalUIPills(optStatus) {
    const statusPill = document.getElementById("global-status-pill");
    const statusText = document.getElementById("global-status-text");

    statusPill.className = `status-indicator-pill ${optStatus.rating}`;
    statusText.innerText = optStatus.currentBlockName;

    // Actualizar también la campana/alerta en la pestaña de recomendaciones
    const tabBadge = document.getElementById("optimizer-tab-badge");
    if (optStatus.conflictZoneWarning) {
        tabBadge.classList.remove("hidden");
    } else {
        tabBadge.classList.add("hidden");
    }
}

// Muestra/Oculta el banner superior de conflicto
function renderGlobalAlertBanner(optStatus) {
    const banner = document.getElementById("global-conflict-banner");
    const title = document.getElementById("banner-title");
    const message = document.getElementById("banner-message");

    if (optStatus.conflictZoneWarning) {
        banner.classList.remove("hidden");
        banner.className = `conflict-alert-banner ${optStatus.rating}`;
        
        if (optStatus.rating === "danger") {
            title.innerText = `🚨 Tránsito Escolar Activo: ${optStatus.currentBlockName}`;
            message.innerText = `Los estudiantes están fuera de las aulas. Por favor, posterga el aseo de salas hasta el término de este bloque (${optStatus.currentBlockTime.split(" ")[2]} hrs).`;
        } else {
            title.innerText = `⚠️ Conflicto de Aseo Próximo: ${optStatus.nextConflictName}`;
            message.innerText = `Un recreo o evento iniciará en ${optStatus.minutesToConflict} minutos. Se sugiere esperar para limpiar las salas de clases.`;
        }
    } else {
        banner.classList.add("hidden");
    }
}

// Renderiza la cuadrícula de salas y canchas del Módulo 1
function renderMarkingPanel(optStatus) {
    const salasGrid = document.getElementById("salas-grid");
    const canchasGrid = document.getElementById("canchas-grid");
    
    salasGrid.innerHTML = "";
    canchasGrid.innerHTML = "";

    appState.zones.forEach((zone) => {
        const btn = document.createElement("button");
        btn.id = `btn-zone-${zone.id}`;
        
        // Estilos base y de optimización
        let classList = ["zone-btn"];
        
        // 1. Determinar si está limpio (menos de 4 horas desde la última limpieza)
        const isClean = zone.lastClean && (Date.now() - new Date(zone.lastClean).getTime() < 4 * 60 * 60 * 1000);
        if (isClean) {
            classList.push("clean");
        } else if (zone.lastClean) {
            classList.push("dirty"); // Requiere atención
        }

        // 2. Aplicar advertencia visual si es sala y hay conflicto escolar activo
        if (optStatus.conflictZoneWarning && zone.type === "sala") {
            classList.push("warn-collision");
        }

        btn.className = classList.join(" ");

        // Formatear timestamp de última limpieza
        let timeDisplay = "Sin registrar";
        if (zone.lastClean) {
            const cleanDate = new Date(zone.lastClean);
            const hrs = String(cleanDate.getHours()).padStart(2, '0');
            const mins = String(cleanDate.getMinutes()).padStart(2, '0');
            timeDisplay = `Último aseo: ${hrs}:${mins} hrs`;
        }

        const statusLabel = isClean ? "Limpio" : "Requiere Aseo";

        // Layout diferenciado para salas (grid compacto) vs canchas (filas anchas)
        if (zone.type === "sala") {
            btn.innerHTML = `
                <span class="zone-name">${zone.name}</span>
                <span class="zone-status-pill">${statusLabel}</span>
                <span class="zone-time">${timeDisplay}</span>
            `;
        } else {
            // Estructura adaptada para canchas deportivas
            btn.innerHTML = `
                <div class="zone-details">
                    <span class="zone-name">${zone.name}</span>
                </div>
                <div class="zone-time-status">
                    <span class="zone-status-pill">${statusLabel}</span>
                    <span class="zone-time">${timeDisplay}</span>
                </div>
            `;
        }

        // Evento de clic para marcar como "Limpio"
        btn.addEventListener("click", () => {
            markZoneAsClean(zone, optStatus);
        });

        // Distribuir en el contenedor correspondiente
        if (zone.type === "sala") {
            salasGrid.appendChild(btn);
        } else {
            canchasGrid.appendChild(btn);
        }
    });
}

// Acción de registro de aseo
function markZoneAsClean(zone, optStatus) {
    const prevClean = zone.lastClean;
    zone.lastClean = new Date().toISOString();
    saveAseosToStorage();
    renderAll();

    const hrs = String(new Date().getHours()).padStart(2, '0');
    const mins = String(new Date().getMinutes()).padStart(2, '0');

    // Generar avisos amigables
    if (optStatus.conflictZoneWarning && zone.type === "sala") {
        showToast(`⚠️ Registrado a las ${hrs}:${mins}. Cuidado: el aseo podría perderse rápido por recreo inminente.`, "warning");
    } else {
        showToast(`✨ ${zone.name} marcado como LIMPIO a las ${hrs}:${mins} hrs.`, "success");
    }
}

// Renderiza la sección de Alertas y Recomendaciones del Módulo 2
function renderOptimizationDashboard(optStatus) {
    // 1. Actualizar Tarjeta de Resumen Actual
    const summaryCard = document.getElementById("opt-status-summary");
    summaryCard.className = `glass-card status-summary-card ${optStatus.rating}`;
    
    document.getElementById("opt-current-block-type").innerText = optStatus.currentBlockType;
    document.getElementById("opt-current-block-name").innerText = optStatus.currentBlockName;
    document.getElementById("opt-current-block-time").innerText = optStatus.currentBlockTime;
    
    // Gráfico de anillo
    const graphicContainer = document.getElementById("opt-status-graphic");
    graphicContainer.innerHTML = `
        <div class="gauge-ring ${optStatus.rating}">
            <div class="gauge-fill"></div>
            <span class="gauge-text">${optStatus.label}</span>
        </div>
        <div class="gauge-description">
            <h3>${optStatus.title}</h3>
            <p>${optStatus.text}</p>
        </div>
    `;

    // 2. Renderizar Cronograma de Recomendaciones
    const timelineContainer = document.getElementById("optimizer-timeline-container");
    timelineContainer.innerHTML = "";

    appState.calendar
        .slice()
        .sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start))
        .forEach((block) => {
            const item = document.createElement("div");
            
            // Evaluar la recomendación ficticia para ese bloque específico
            let blockRating = "success";
            let blockText = "Excelente momento para limpiar salas.";
            let badgeLabel = "Óptimo";

            if (block.type === "recreo") {
                blockRating = "danger";
                blockText = "Evitar limpiar salas. Alumnos fuera de clase.";
                badgeLabel = "Tránsito Alto";
            } else if (block.type === "evento") {
                blockRating = "warning";
                blockText = "Tránsito moderado/alto. Limpiar con cuidado.";
                badgeLabel = "Precaución";
            }

            // Detectar si este bloque es el que se está ejecutando actualmente
            const currentFormattedTime = getCurrentTimeFormatted();
            const currentMins = timeStringToMinutes(currentFormattedTime);
            const bStart = timeStringToMinutes(block.start);
            const bEnd = timeStringToMinutes(block.end);
            const isCurrent = currentMins >= bStart && currentMins < bEnd;

            let itemClasses = ["timeline-item", blockRating];
            if (isCurrent) {
                itemClasses.push("current");
            }

            item.className = itemClasses.join(" ");
            item.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-content-left">
                        <h4>${block.name}</h4>
                        <p class="table-time">${block.start} - ${block.end} hrs | ${blockText}</p>
                    </div>
                    <span class="timeline-badge">${badgeLabel}</span>
                </div>
            `;
            timelineContainer.appendChild(item);
        });
}

// Renderiza la tabla de bloques en el Módulo de Administración
function renderCalendarBlocksTable() {
    const tbody = document.getElementById("calendar-blocks-tbody");
    tbody.innerHTML = "";

    appState.calendar
        .slice()
        .sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start))
        .forEach((block, index) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="table-badge ${block.type}">${block.type}</span></td>
                <td><strong>${block.name}</strong></td>
                <td class="table-time">${block.start}</td>
                <td class="table-time">${block.end}</td>
                <td>
                    <div class="table-actions">
                        <button class="secondary-btn btn-sm edit-block-btn" data-index="${index}">✏️</button>
                        <button class="danger-btn btn-sm delete-block-btn" data-index="${index}">❌</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    // Agregar listeners a los botones generados
    document.querySelectorAll(".edit-block-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = e.currentTarget.getAttribute("data-index");
            openBlockModal(index);
        });
    });

    document.querySelectorAll(".delete-block-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = e.currentTarget.getAttribute("data-index");
            deleteBlock(index);
        });
    });
}

// Estadísticas rápidas en la intro de marcado
function updateQuickStats() {
    // Contar cuántas zonas fueron limpiadas hoy (desde las 00:00 del día actual)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const cleanedTodayCount = appState.zones.filter(z => {
        return z.lastClean && new Date(z.lastClean).getTime() >= startOfToday.getTime();
    }).length;

    document.getElementById("stat-cleaned-count").innerText = cleanedTodayCount;
}

// 6. EVENTOS Y NAVEGACIÓN
function setupEventListeners() {
    // Navegación de Pestañas
    document.querySelectorAll(".nav-tab").forEach((tab) => {
        tab.addEventListener("click", (e) => {
            const targetTab = e.currentTarget.getAttribute("data-tab");
            
            // Alternar clases activas en botones
            document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
            e.currentTarget.classList.add("active");

            // Alternar visibilidad de secciones
            document.querySelectorAll(".tab-content").forEach(section => section.classList.remove("active"));
            document.getElementById(targetTab).classList.add("active");
            
            appState.activeTab = targetTab;
        });
    });

    // Toggle del Simulador
    const simToggle = document.getElementById("simulator-toggle");
    const simControls = document.getElementById("sim-controls-wrapper");
    const simTimeSlider = document.getElementById("sim-time-slider");

    simToggle.addEventListener("change", (e) => {
        appState.isSimulatorOn = e.target.checked;
        if (appState.isSimulatorOn) {
            simControls.classList.remove("collapsed");
            showToast("🎮 Modo Simulador Activado. Usa la barra para cambiar la hora escolar.", "info");
        } else {
            simControls.classList.add("collapsed");
            showToast("⏱️ Volviendo a la hora del sistema real.", "info");
        }
        renderAll();
    });

    // Slider del Simulador
    simTimeSlider.addEventListener("input", (e) => {
        appState.simulatedMinutes = parseInt(e.target.value);
        updateSimulatedTimeBadge();
        renderAll();
    });

    // Presets rápidos del simulador
    document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const timeVal = e.target.getAttribute("data-time");
            const mins = timeStringToMinutes(timeVal);
            
            simTimeSlider.value = mins;
            appState.simulatedMinutes = mins;
            updateSimulatedTimeBadge();
            renderAll();
            showToast(`⏰ Simulación fijada a las ${timeVal} hrs.`, "info");
        });
    });

    // Resetear todos los registros de aseo
    document.getElementById("btn-reset-all-aseos").addEventListener("click", () => {
        if (confirm("¿Estás seguro de que deseas restablecer el historial de aseo de las 33 zonas? Esto borrará todos los registros actuales.")) {
            buildNewZonesState();
            renderAll();
            showToast("🔄 Historial de aseo reiniciado por completo.", "info");
        }
    });

    // Restaurar calendario académico por defecto
    document.getElementById("btn-restore-default-calendar").addEventListener("click", () => {
        if (confirm("¿Deseas restaurar la programación académica por defecto del Colegio San Nicolás de Mira?")) {
            appState.calendar = [...DEFAULT_CALENDAR];
            saveCalendarToStorage();
            renderAll();
            showToast("📅 Programación escolar restaurada al diseño estándar.", "success");
        }
    });

    // Modales y Formularios de Bloques
    document.getElementById("btn-add-block-modal").addEventListener("click", () => {
        openBlockModal();
    });

    document.getElementById("btn-cancel-modal").addEventListener("click", closeBlockModal);

    document.getElementById("block-form").addEventListener("submit", (e) => {
        e.preventDefault();
        saveBlockFromForm();
    });

    // Carga de Archivos JSON (Arrastrar y Soltar)
    const dropZone = document.getElementById("json-drop-zone");
    const fileInput = document.getElementById("json-file-input");

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove("dragover"));
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            handleJsonFile(file);
        }
    });

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            handleJsonFile(file);
        }
    });

    // Descargar Calendario actual como JSON
    document.getElementById("btn-download-calendar").addEventListener("click", downloadCalendarJson);
}

// 7. COMPONENTE MODAL DE EDICIÓN DE CALENDARIO
function openBlockModal(index = null) {
    const modal = document.getElementById("block-modal");
    const form = document.getElementById("block-form");
    const title = document.getElementById("modal-title");
    
    form.reset();
    modal.classList.remove("hidden");

    if (index !== null) {
        // Modo Edición
        const block = appState.calendar[index];
        title.innerText = "Editar Bloque Académico";
        document.getElementById("edit-block-index").value = index;
        document.getElementById("block-name").value = block.name;
        document.getElementById("block-type").value = block.type;
        document.getElementById("block-start").value = block.start;
        document.getElementById("block-end").value = block.end;
    } else {
        // Modo Creación
        title.innerText = "Añadir Bloque Académico";
        document.getElementById("edit-block-index").value = "";
    }
}

function closeBlockModal() {
    document.getElementById("block-modal").classList.add("hidden");
}

function saveBlockFromForm() {
    const index = document.getElementById("edit-block-index").value;
    const name = document.getElementById("block-name").value;
    const type = document.getElementById("block-type").value;
    const start = document.getElementById("block-start").value;
    const end = document.getElementById("block-end").value;

    const blockData = { name, type, start, end };

    // Validar solapamiento lógico básico (start < end)
    if (timeStringToMinutes(start) >= timeStringToMinutes(end)) {
        alert("La hora de inicio debe ser anterior a la hora de término.");
        return;
    }

    if (index !== "") {
        // Reemplazar existente
        appState.calendar[parseInt(index)] = blockData;
        showToast("✏️ Bloque académico actualizado.", "success");
    } else {
        // Añadir nuevo
        appState.calendar.push(blockData);
        showToast("➕ Nuevo bloque escolar agregado con éxito.", "success");
    }

    saveCalendarToStorage();
    closeBlockModal();
    renderAll();
}

function deleteBlock(index) {
    if (confirm(`¿Estás seguro de que deseas eliminar el bloque "${appState.calendar[index].name}"?`)) {
        appState.calendar.splice(index, 1);
        saveCalendarToStorage();
        renderAll();
        showToast("❌ Bloque eliminado del calendario escolar.", "success");
    }
}

// 8. IMPORTACIÓN Y EXPORTACIÓN JSON
function handleJsonFile(file) {
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        showToast("❌ Formato de archivo no válido. Debe ser un archivo .json.", "warning");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validar la estructura del JSON importado
            if (Array.isArray(data) && data.every(b => b.name && b.type && b.start && b.end)) {
                appState.calendar = data;
                saveCalendarToStorage();
                renderAll();
                showToast("📥 ¡Calendario académico importado exitosamente!", "success");
            } else {
                showToast("❌ Formato JSON interno inválido. Falta campos obligatorios.", "warning");
            }
        } catch (err) {
            showToast("❌ Error al decodificar el archivo JSON.", "warning");
        }
    };
    reader.readAsText(file);
}

function downloadCalendarJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.calendar, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "calendario_san_nicolas.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("💾 Archivo de configuración descargado.", "success");
}

// 9. RELOJ DEL SISTEMA EN VIVO
function startLiveClock() {
    setInterval(() => {
        const now = new Date();
        
        let hrs = now.getHours();
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        
        // Ajustar formato de 12 horas para display premium
        hrs = hrs % 12;
        hrs = hrs ? hrs : 12; // 0 debe ser 12
        const hrsStr = String(hrs).padStart(2, '0');

        // Formatear Fecha
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const dateStr = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;

        // Si el simulador está apagado, mostrar la hora real
        if (!appState.isSimulatorOn) {
            document.getElementById("live-time").innerText = `${hrsStr}:${mins}:${secs}`;
            document.getElementById("live-ampm").innerText = ampm;
            document.getElementById("live-date").innerText = dateStr;

            // Cada minuto recalcular el estado y alertas
            if (now.getSeconds() === 0) {
                renderAll();
            }
        }
    }, 1000);
    
    // Inicializar visualización de barra de simulación
    updateSimulatedTimeBadge();
}

// Actualiza el badge visual del slider del simulador
function updateSimulatedTimeBadge() {
    const totalMins = appState.simulatedMinutes;
    let hrs = Math.floor(totalMins / 60);
    const mins = String(totalMins % 60).padStart(2, '0');
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    const hrsStr = String(hrs).padStart(2, '0');

    document.getElementById("sim-time-badge").innerText = `${hrsStr}:${mins} ${ampm}`;

    // Si el simulador está ENCENDIDO, reescribir reloj principal
    if (appState.isSimulatorOn) {
        document.getElementById("live-time").innerText = `${hrsStr}:${mins}:00`;
        document.getElementById("live-ampm").innerText = ampm;
        document.getElementById("live-date").innerText = "Jueves, 28 de Mayo (Simulación)";
    }
}

// 10. HELPERS DE CONVERSIÓN DE TIEMPO
function timeStringToMinutes(timeStr) {
    const [hrs, mins] = timeStr.split(":").map(Number);
    return hrs * 60 + mins;
}

function getCurrentTimeFormatted() {
    if (appState.isSimulatorOn) {
        const totalMins = appState.simulatedMinutes;
        const hrs = String(Math.floor(totalMins / 60)).padStart(2, '0');
        const mins = String(totalMins % 60).padStart(2, '0');
        return `${hrs}:${mins}`;
    } else {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        return `${hrs}:${mins}`;
    }
}

// 11. SISTEMA PREMIUM DE TOAST NOTIFICATIONS
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);

    // Autoeliminar después del ciclo de animación (3 segundos)
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
