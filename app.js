/* ==========================================================================
   LÓGICA CENTRAL DE LA APLICACIÓN - COLEGIO SAN NICOLÁS DE MIRA
   Controlador de Módulo de Marcado, Horarios ( रेगुलर/विशेष ) y Motor de Optimización
   ========================================================================== */

// 1. CONFIGURACIÓN DE LOS DOS ESQUEMAS DE HORARIOS (ADENDA)
const SCHEDULE_1 = [
    { name: "Bloque 1", type: "clase", start: "08:15", end: "10:20" },
    { name: "Recreo", type: "recreo", start: "10:20", end: "10:35" },
    { name: "Bloque 2", type: "clase", start: "10:35", end: "11:55" },
    { name: "Recreo", type: "recreo", start: "11:55", end: "12:10" },
    { name: "Bloque 3", type: "clase", start: "12:10", end: "13:30" },
    { name: "Almuerzo", type: "recreo", start: "13:30", end: "14:10" },
    { name: "Bloque 4", type: "clase", start: "14:10", end: "15:30" }
];

const SCHEDULE_2 = [
    { name: "Bloque 1", type: "clase", start: "08:15", end: "09:40" },
    { name: "Recreo", type: "recreo", start: "09:40", end: "09:55" },
    { name: "Bloque 2", type: "clase", start: "09:55", end: "11:55" },
    { name: "Recreo", type: "recreo", start: "11:55", end: "12:35" },
    { name: "Bloque 3", type: "clase", start: "12:35", end: "13:55" },
    { name: "Recreo", type: "recreo", start: "13:55", end: "14:10" },
    { name: "Bloque 4", type: "clase", start: "14:10", end: "15:30" }
];

// Nombres exactos de las canchas solicitadas
const SPECIAL_ZONES = [
    "Cancha Central",
    "Cancha de Básquetbol",
    "Cancha de Fútbol"
];

// ESTADO GLOBAL DE LA APLICACIÓN
let appState = {
    activeSchedule: 1, // 1 (Regular) o 2 (Especial)
    zones: [],         // Timestamps y estados de aseo
    calendar: [],      // Programación diaria activa (Horario 1 o Horario 2)
    isSimulatorOn: false,
    simulatedMinutes: 676, // Inicialmente 11:16 AM en minutos desde las 00:00 (11*60 + 16 = 676)
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
    // A. Inicializar Tipo de Horario Activo (1 o 2)
    const savedActiveSched = localStorage.getItem("san_nicolas_active_schedule");
    if (savedActiveSched) {
        appState.activeSchedule = parseInt(savedActiveSched);
    } else {
        appState.activeSchedule = 1;
        localStorage.setItem("san_nicolas_active_schedule", 1);
    }

    // B. Inicializar Calendario
    const savedCalendar = localStorage.getItem("san_nicolas_calendar");
    if (savedCalendar) {
        appState.calendar = JSON.parse(savedCalendar);
    } else {
        appState.calendar = appState.activeSchedule === 1 ? [...SCHEDULE_1] : [...SCHEDULE_2];
        localStorage.setItem("san_nicolas_calendar", JSON.stringify(appState.calendar));
    }

    // Sincronizar clases activas en los botones de selección en el DOM una vez cargados
    setTimeout(() => {
        updateScheduleSelectorUI();
    }, 30);

    // C. Inicializar Zonas de Aseo (33 casillas: 30 salas + 3 canchas exactas)
    const savedAseos = localStorage.getItem("san_nicolas_aseos");
    if (savedAseos) {
        appState.zones = JSON.parse(savedAseos);
        
        // Sanity Check: Asegurar que hay exactamente 33 zonas
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

// 4. MOTOR DE OPTIMIZACIÓN Y ALERTAS (ADENDA DE REGLAS)
function getOptimizationStatus(timeStr) {
    const currentMins = timeStringToMinutes(timeStr);
    
    // VENTANA IDEAL: Final de la jornada después de las 15:30 (Salida)
    if (currentMins >= 930) { // 15:30 = 15*60 + 30 = 930 minutos
        return {
            rating: "success", // Verde
            label: "Óptimo",
            title: "¡Horario Óptimo (Fin de Jornada)!",
            text: "La jornada escolar regular ha finalizado (después de las 15:30). Excelente momento para realizar el aseo profundo de salas y canchas sin interrupciones.",
            currentBlockName: "Fin de Jornada Escolar",
            currentBlockTime: "15:30 - 23:59 hrs",
            currentBlockType: "salida",
            conflictZoneWarning: false,
            minutesToConflict: null,
            nextConflictName: "",
            isOptimalWindow: true
        };
    }

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

    // Horario antes de la entrada (antes de las 8:15 AM)
    if (!currentBlock && currentMins < 495) { // 08:15 = 8*60 + 15 = 495 minutos
        return {
            rating: "success", // Verde
            label: "Óptimo",
            title: "Horario Previo a Clases",
            text: "Aún no inicia el primer bloque de clases de hoy. Gran momento para dejar las salas preparadas antes de la entrada de alumnos.",
            currentBlockName: "Antes de Clases",
            currentBlockTime: "00:00 - 08:15 hrs",
            currentBlockType: "libre",
            conflictZoneWarning: false,
            minutesToConflict: null,
            nextConflictName: "",
            isOptimalWindow: true
        };
    }

    // Si no calza en ningún bloque escolar (ej. recreo largo ya terminado pero antes de clases tarde)
    if (!currentBlock) {
        currentBlock = { name: "Bloque Libre / Ventana", type: "libre", start: "08:15", end: "15:30" };
    }

    // A. RECREO O ALMUERZO ACTIVO (Alerta roja - Evitar limpiar)
    if (currentBlock.type === "recreo" || currentBlock.type === "evento") {
        const blockTypeName = currentBlock.name.toLowerCase().includes("almuerzo") ? "almuerzo" : "recreo";
        return {
            rating: "danger", // Rojo
            label: "Evitar",
            title: `${currentBlock.name} Activo`,
            text: `Hay un ${blockTypeName} en curso ("${currentBlock.name}"). Evitar limpiar salas ya que los alumnos circulan por los pasillos y se ensuciarán de inmediato.`,
            currentBlockName: currentBlock.name,
            currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
            currentBlockType: currentBlock.type,
            conflictZoneWarning: true, // Avisa de evitar limpieza
            minutesToConflict: 0,
            nextConflictName: currentBlock.name,
            isOptimalWindow: false
        };
    }

    // B. REGLA: BLOQUEO DE EFICIENCIA (Últimos 20 minutos de un bloque de clases)
    if (currentBlock.type === "clase") {
        const blockEndMins = timeStringToMinutes(currentBlock.end);
        const minsRemaining = blockEndMins - currentMins;

        if (minsRemaining <= 20) {
            return {
                rating: "warning", // Naranja
                label: "Postponer",
                title: "Eficiencia de Aseo Baja",
                // Texto exacto solicitado por la regla
                text: "Sugerencia: Esperar a que termine el recreo para limpiar, la sala se ensuciará pronto",
                currentBlockName: currentBlock.name,
                currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
                currentBlockType: currentBlock.type,
                conflictZoneWarning: true, // Bloquea/Advierte visualmente en las casillas
                minutesToConflict: minsRemaining,
                nextConflictName: nextConflictBlock ? nextConflictBlock.name : "Recreo",
                isOptimalWindow: false
            };
        }
    }

    // C. REGLA: VENTANA IDEAL (Inicio de bloque de clases: primeros 20 minutos)
    if (currentBlock.type === "clase") {
        const blockStartMins = timeStringToMinutes(currentBlock.start);
        const minsElapsed = currentMins - blockStartMins;

        if (minsElapsed <= 20) {
            return {
                rating: "success", // Verde
                label: "Óptimo",
                title: "Horario Óptimo (Inicio de Clase)",
                text: `Los alumnos acaban de entrar a clases (${currentBlock.name}) y restan más de 20 minutos del bloque. Limpiar ahora garantiza una máxima duración del aseo.`,
                currentBlockName: currentBlock.name,
                currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
                currentBlockType: currentBlock.type,
                conflictZoneWarning: false,
                minutesToConflict: null,
                nextConflictName: "",
                isOptimalWindow: true
            };
        }
    }

    // D. HORARIO DE CLASE STANDARD (Intermedio: tras primeros 20 mins y antes de los últimos 20 mins)
    if (currentBlock.type === "clase") {
        // En caso de que falten menos de 30 mins para el próximo recreo (pero estemos entre 21 y 30 mins, por ende no aplica bloqueo de 20 mins)
        if (nextConflictBlock) {
            const nextConflictStart = timeStringToMinutes(nextConflictBlock.start);
            const diffMinutes = nextConflictStart - currentMins;

            if (diffMinutes <= 30) {
                return {
                    rating: "warning",
                    label: "Postponer",
                    title: "¡Recreo Próximo!",
                    text: `Un recreo iniciará en ${diffMinutes} minutos. Se sugiere postergar la limpieza de salas hasta después del recreo para evitar desperdiciar el esfuerzo.`,
                    currentBlockName: currentBlock.name,
                    currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
                    currentBlockType: currentBlock.type,
                    conflictZoneWarning: true,
                    minutesToConflict: diffMinutes,
                    nextConflictName: nextConflictBlock.name,
                    isOptimalWindow: false
                };
            }
        }

        // Horario normal de clase lectiva (Favorable)
        return {
            rating: "success", 
            label: "Favorable",
            title: "Limpieza Favorable (En clases)",
            text: `Los alumnos están en clases (${currentBlock.name}). Buen momento para realizar limpieza silenciosa sin interrupciones directas de estudiantes.`,
            currentBlockName: currentBlock.name,
            currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
            currentBlockType: currentBlock.type,
            conflictZoneWarning: false,
            minutesToConflict: null,
            nextConflictName: "",
            isOptimalWindow: false
        };
    }

    // Por defecto (Seguro)
    return {
        rating: "success",
        label: "Óptimo",
        title: "Bloque Disponible",
        text: "No se registran clases activas ni recreos inminentes en este bloque.",
        currentBlockName: "Ventana Libre",
        currentBlockTime: "08:15 - 15:30 hrs",
        currentBlockType: "libre",
        conflictZoneWarning: false,
        minutesToConflict: null,
        nextConflictName: "",
        isOptimalWindow: true
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

// Sincroniza badges del header principal
function updateGlobalUIPills(optStatus) {
    const statusPill = document.getElementById("global-status-pill");
    const statusText = document.getElementById("global-status-text");

    statusPill.className = `status-indicator-pill ${optStatus.rating}`;
    statusText.innerText = optStatus.currentBlockName;

    // Badge rojo/alerta en pestaña de recomendaciones
    const tabBadge = document.getElementById("optimizer-tab-badge");
    if (optStatus.conflictZoneWarning) {
        tabBadge.classList.remove("hidden");
    } else {
        tabBadge.classList.add("hidden");
    }
}

// Muestra/Oculta banner superior de conflicto
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
            // Caso Bloqueo de Eficiencia o pre-recreo normal
            title.innerText = `⚠️ Advertencia de Eficiencia de Aseo`;
            message.innerText = optStatus.text; // Utiliza el texto de adenda
        }
    } else {
        banner.classList.add("hidden");
    }
}

// Módulo 1: Cuadrícula visual
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
        
        // 1. Determinar si está limpio (menos de 4 horas)
        const isClean = zone.lastClean && (Date.now() - new Date(zone.lastClean).getTime() < 4 * 60 * 60 * 1000);
        if (isClean) {
            classList.push("clean");
        } else if (zone.lastClean) {
            classList.push("dirty"); // Requiere atención
        }

        // 2. Aplicar advertencia visual si es sala y hay conflicto activo
        if (optStatus.conflictZoneWarning && zone.type === "sala") {
            classList.push("warn-collision");
        }

        btn.className = classList.join(" ");

        // Formatear timestamp de última limpieza (Formato exacto solicitado)
        let timeDisplay = "Sin registrar";
        if (zone.lastClean) {
            const cleanDate = new Date(zone.lastClean);
            const hrs = String(cleanDate.getHours()).padStart(2, '0');
            const mins = String(cleanDate.getMinutes()).padStart(2, '0');
            timeDisplay = `Último aseo: ${hrs}:${mins} hrs`;
        }

        const statusLabel = isClean ? "Limpio" : "Requiere Aseo";

        // Renderizado
        if (zone.type === "sala") {
            btn.innerHTML = `
                <span class="zone-name">${zone.name}</span>
                <span class="zone-status-pill">${statusLabel}</span>
                <span class="zone-time">${timeDisplay}</span>
            `;
        } else {
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

        // Evento de clic
        btn.addEventListener("click", () => {
            markZoneAsClean(zone, optStatus);
        });

        if (zone.type === "sala") {
            salasGrid.appendChild(btn);
        } else {
            canchasGrid.appendChild(btn);
        }
    });
}

// Acción de registro de aseo
function markZoneAsClean(zone, optStatus) {
    zone.lastClean = new Date().toISOString();
    saveAseosToStorage();
    renderAll();

    const hrs = String(new Date().getHours()).padStart(2, '0');
    const mins = String(new Date().getMinutes()).padStart(2, '0');

    // Avisos dinámicos en los Toast
    if (optStatus.conflictZoneWarning && zone.type === "sala") {
        showToast(`⚠️ Registrado a las ${hrs}:${mins}. ${optStatus.text}`, "warning");
    } else if (optStatus.isOptimalWindow) {
        showToast(`✨ ¡Aseo óptimo! ${zone.name} marcado como LIMPIO a las ${hrs}:${mins} hrs.`, "success");
    } else {
        showToast(`✨ ${zone.name} marcado como LIMPIO a las ${hrs}:${mins} hrs.`, "success");
    }
}

// Módulo 2: Alertas y recomendaciones
function renderOptimizationDashboard(optStatus) {
    // 1. Actualizar Tarjeta de Resumen Actual
    const summaryCard = document.getElementById("opt-status-summary");
    
    // Determinar la clase del marco de optimización
    let graphicRating = optStatus.rating;
    if (optStatus.label === "Favorable") {
        graphicRating = "success"; // Usar verde para favorable en el borde del anillo
    }
    summaryCard.className = `glass-card status-summary-card ${optStatus.rating}`;
    
    document.getElementById("opt-current-block-type").innerText = optStatus.currentBlockType;
    document.getElementById("opt-current-block-name").innerText = optStatus.currentBlockName;
    document.getElementById("opt-current-block-time").innerText = optStatus.currentBlockTime;
    
    // Gráfico de anillo y descripciones
    const graphicContainer = document.getElementById("opt-status-graphic");
    graphicContainer.innerHTML = `
        <div class="gauge-ring ${graphicRating}">
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
            
            // Evaluar recomendación para el timeline
            let blockRating = "success";
            let blockText = "Bloque de clases: Inicio ideal para limpiar.";
            let badgeLabel = "Óptimo";

            if (block.type === "recreo" || block.type === "evento") {
                blockRating = "danger";
                blockText = block.name === "Almuerzo" ? "Almuerzo activo: alumnos en comedor." : "Recreo en curso: flujo masivo en salas.";
                badgeLabel = "Evitar";
            }

            // Detectar si este bloque es el actual
            const currentFormattedTime = getCurrentTimeFormatted();
            const currentMins = timeStringToMinutes(currentFormattedTime);
            const bStart = timeStringToMinutes(block.start);
            const bEnd = timeStringToMinutes(block.end);
            const isCurrent = currentMins >= bStart && currentMins < bEnd;

            // Rating intermedio para el bloque actual según el motor exacto
            if (isCurrent) {
                blockRating = optStatus.rating;
                blockText = optStatus.text;
                badgeLabel = optStatus.label;
            }

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

// Renderiza tabla de bloques del administrador
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

    // Event listeners para botones generados
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

// Estadísticas rápidas en el Módulo 1
function updateQuickStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const cleanedTodayCount = appState.zones.filter(z => {
        return z.lastClean && new Date(z.lastClean).getTime() >= startOfToday.getTime();
    }).length;

    document.getElementById("stat-cleaned-count").innerText = cleanedTodayCount;
}

// 6. EVENTOS, NAVEGACIÓN Y SELECTOR DE HORARIOS (ADENDA)
function setupEventListeners() {
    // A. Selector de Horarios (Horario 1 vs Horario 2)
    const btnSched1 = document.getElementById("btn-sched-1");
    const btnSched2 = document.getElementById("btn-sched-2");

    if (btnSched1 && btnSched2) {
        btnSched1.addEventListener("click", () => switchSchedule(1));
        btnSched2.addEventListener("click", () => switchSchedule(2));
    }

    // B. Navegación de Pestañas
    document.querySelectorAll(".nav-tab").forEach((tab) => {
        tab.addEventListener("click", (e) => {
            const targetTab = e.currentTarget.getAttribute("data-tab");
            
            document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
            e.currentTarget.classList.add("active");

            document.querySelectorAll(".tab-content").forEach(section => section.classList.remove("active"));
            document.getElementById(targetTab).classList.add("active");
            
            appState.activeTab = targetTab;
        });
    });

    // C. Toggle del Simulador
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

    // Presets del simulador
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

    // Restaurar calendario académico al original por defecto
    document.getElementById("btn-restore-default-calendar").addEventListener("click", () => {
        if (confirm("¿Deseas restaurar la programación académica original de este horario?")) {
            appState.calendar = appState.activeSchedule === 1 ? [...SCHEDULE_1] : [...SCHEDULE_2];
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

// 7. INTERRUPTOR DE HORARIOS DIARIOS (LÓGICA ADENDA)
function switchSchedule(type) {
    appState.activeSchedule = type;
    localStorage.setItem("san_nicolas_active_schedule", type);
    
    // Asignar plantilla correspondiente
    if (type === 1) {
        appState.calendar = [...SCHEDULE_1];
    } else {
        appState.calendar = [...SCHEDULE_2];
    }
    
    updateScheduleSelectorUI();
    saveCalendarToStorage();
    renderAll();
    
    const schedName = type === 1 ? "Horario 1 (Regular)" : "Horario 2 (Especial)";
    showToast(`📅 Configurado e Importado: ${schedName} para hoy.`, "success");
}

function updateScheduleSelectorUI() {
    const btnSched1 = document.getElementById("btn-sched-1");
    const btnSched2 = document.getElementById("btn-sched-2");
    
    if (btnSched1 && btnSched2) {
        if (appState.activeSchedule === 1) {
            btnSched1.classList.add("active");
            btnSched2.classList.remove("active");
        } else {
            btnSched2.classList.add("active");
            btnSched1.classList.remove("active");
        }
    }
}

// 8. COMPONENTE MODAL DE EDICIÓN DE CALENDARIO
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

    // Validar solapamiento lógico básico
    if (timeStringToMinutes(start) >= timeStringToMinutes(end)) {
        alert("La hora de inicio debe ser anterior a la hora de término.");
        return;
    }

    if (index !== "") {
        appState.calendar[parseInt(index)] = blockData;
        showToast("✏️ Bloque académico actualizado.", "success");
    } else {
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

// 9. IMPORTACIÓN Y EXPORTACIÓN JSON
function handleJsonFile(file) {
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        showToast("❌ Formato de archivo no válido. Debe ser un archivo .json.", "warning");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (Array.isArray(data) && data.every(b => b.name && b.type && b.start && b.end)) {
                appState.calendar = data;
                saveCalendarToStorage();
                renderAll();
                showToast("📥 ¡Calendario académico importado exitosamente!", "success");
            } else {
                showToast("❌ Formato JSON interno inválido. Faltan campos obligatorios.", "warning");
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
    downloadAnchor.setAttribute("download", `calendario_san_nicolas_horario_${appState.activeSchedule}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("💾 Archivo de configuración descargado.", "success");
}

// 10. RELOJ DEL SISTEMA EN VIVO
function startLiveClock() {
    setInterval(() => {
        const now = new Date();
        
        let hrs = now.getHours();
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        
        hrs = hrs % 12;
        hrs = hrs ? hrs : 12;
        const hrsStr = String(hrs).padStart(2, '0');

        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const dateStr = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;

        if (!appState.isSimulatorOn) {
            document.getElementById("live-time").innerText = `${hrsStr}:${mins}:${secs}`;
            document.getElementById("live-ampm").innerText = ampm;
            document.getElementById("live-date").innerText = dateStr;

            if (now.getSeconds() === 0) {
                renderAll();
            }
        }
    }, 1000);
    
    updateSimulatedTimeBadge();
}

function updateSimulatedTimeBadge() {
    const totalMins = appState.simulatedMinutes;
    let hrs = Math.floor(totalMins / 60);
    const mins = String(totalMins % 60).padStart(2, '0');
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    const hrsStr = String(hrs).padStart(2, '0');

    document.getElementById("sim-time-badge").innerText = `${hrsStr}:${mins} ${ampm}`;

    if (appState.isSimulatorOn) {
        document.getElementById("live-time").innerText = `${hrsStr}:${mins}:00`;
        document.getElementById("live-ampm").innerText = ampm;
        document.getElementById("live-date").innerText = "Jueves, 28 de Mayo (Simulación)";
    }
}

// 11. HELPERS DE CONVERSIÓN DE TIEMPO
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

// 12. SISTEMA PREMIUM DE TOAST NOTIFICATIONS
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
