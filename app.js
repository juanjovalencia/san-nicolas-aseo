/* ==========================================================================
   LÓGICA CENTRAL DE LA APLICACIÓN - COLEGIO SAN NICOLÁS DE MYRA
   Controlador de Módulo de Marcado, Horarios y Motor de Optimización
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

// Canchas deportivas (Nombres exactos)
const SPECIAL_ZONES = [
    "Cancha Central",
    "Cancha de Básquetbol",
    "Cancha de Fútbol"
];

// Estructura ordenada de Baños y Camarines (18 puntos en total)
const BANO_CAMARIN_DEFINITIONS = [
    // Primer Piso Básica (4)
    { name: "Baño Mujeres (1er Piso)", type: "bano", floor: 1 },
    { name: "Baño Hombres (1er Piso)", type: "bano", floor: 1 },
    { name: "Baño Profesores (1er Piso)", type: "bano", floor: 1 },
    { name: "Baño Discapacitados (1er Piso)", type: "bano", floor: 1 },
    
    // Segundo Piso Básica (4)
    { name: "Baño Mujeres (2do Piso)", type: "bano", floor: 2 },
    { name: "Baño Hombres (2do Piso)", type: "bano", floor: 2 },
    { name: "Baño Profesores (2do Piso)", type: "bano", floor: 2 },
    { name: "Baño Discapacitados (2do Piso)", type: "bano", floor: 2 },
    
    // Tercer Piso Media (4)
    { name: "Baño Mujeres (3er Piso)", type: "bano", floor: 3 },
    { name: "Baño Hombres (3er Piso)", type: "bano", floor: 3 },
    { name: "Baño Profesores (3er Piso)", type: "bano", floor: 3 },
    { name: "Baño Discapacitados (3er Piso)", type: "bano", floor: 3 },
    
    // Zonas Comunes y Otros (6)
    { name: "Baño 1 frente a Convivencia Escolar", type: "bano", floor: 4 },
    { name: "Baño 2 frente a Convivencia Escolar", type: "bano", floor: 4 },
    { name: "Baño 1 al lado del Kiosco", type: "bano", floor: 4 },
    { name: "Baño 2 al lado del Kiosco", type: "bano", floor: 4 },
    { name: "Camarín 1 al lado del Casino", type: "camarin", floor: 4 },
    { name: "Camarín 2 al lado del Casino", type: "camarin", floor: 4 }
];

// ESTADO GLOBAL DE LA APLICACIÓN
let appState = {
    activeSchedule: 1, // 1 (Regular) o 2 (Especial)
    zones: [],         // Timestamps y estados de aseo
    calendar: [],      // Programación diaria activa
    isSimulatorOn: false,
    simulatedMinutes: 676, // Inicialmente 11:16 AM en minutos desde las 00:00 (11*60 + 16 = 676)
    activeTab: "tab-marking",
    
    // Módulo 3
    historyLogs: [],       // Bitácora histórica de limpiezas
    currentCalendarDate: new Date(2026, 4, 28), // 28 de Mayo de 2026 por defecto (mes 4 es Mayo en JS, 0-indexed)
    selectedLogDate: new Date(2026, 4, 28),
    activeOperator: "Tía María" // Operaria seleccionada por defecto
};

// SVG ICONOS GENERALES DE ALTA FIDELIDAD
const SVG_ICONS = {
    sala: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    cancha: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
    bano: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 2h10v6H7z"/><path d="M5 8h14v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/><path d="M9 16v5"/><path d="M15 16v5"/></svg>`,
    camarin: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3z"/><path d="M12 5L2 14h20L12 5z"/><circle cx="12" cy="17" r="1"/></svg>`
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

    // Sincronizar clases activas en los botones de selección en el DOM
    setTimeout(() => {
        updateScheduleSelectorUI();
    }, 30);

    // C. Inicializar Zonas (51 casillas en total: 30 salas, 3 canchas, 18 baños/camarines)
    const savedAseos = localStorage.getItem("san_nicolas_aseos");
    if (savedAseos) {
        appState.zones = JSON.parse(savedAseos);
        
        // Sanity Check: Asegurar que hay exactamente 51 zonas (si había 33 limpia localStorage automáticamente)
        if (appState.zones.length !== 51) {
            buildNewZonesState();
        }
    } else {
        buildNewZonesState();
    }

    // D. Inicializar Historial de Aseos
    const savedLogs = localStorage.getItem("san_nicolas_history_logs");
    if (savedLogs) {
        appState.historyLogs = JSON.parse(savedLogs);
    } else {
        generateMockHistoryLogs();
    }
}

function buildNewZonesState() {
    appState.zones = [];
    
    // Generar 30 Salas numeradas y asociadas a su piso (10 salas por piso)
    for (let i = 1; i <= 30; i++) {
        appState.zones.push({
            id: `sala-${i}`,
            name: `Sala ${i}`,
            type: "sala",
            floor: i <= 10 ? 1 : (i <= 20 ? 2 : 3),
            lastClean: null
        });
    }

    // Generar 3 Canchas deportivas
    SPECIAL_ZONES.forEach((canchaName, index) => {
        appState.zones.push({
            id: `cancha-${index + 1}`,
            name: canchaName,
            type: "cancha",
            floor: 4, // Zonas comunes/Exterior
            lastClean: null
        });
    });

    // Generar 18 Baños y Camarines
    BANO_CAMARIN_DEFINITIONS.forEach((def, index) => {
        appState.zones.push({
            id: `bano-camarin-${index + 1}`,
            name: def.name,
            type: def.type,
            floor: def.floor,
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
function getOptimizationStatus(timeStr) {
    const currentMins = timeStringToMinutes(timeStr);
    
    // VENTANA IDEAL: Final de la jornada después de las 15:30 (Salida)
    if (currentMins >= 930) { // 15:30 = 930 minutos
        return {
            rating: "success", // Verde
            label: "Óptimo",
            title: "¡Horario Óptimo (Fin de Jornada)!",
            text: "La jornada escolar regular ha finalizado (después de las 15:30). Excelente ventana de aseo óptima para limpieza profunda sin interrupciones.",
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

    // Encontrar el siguiente bloque relevante
    let nextBlocks = appState.calendar
        .filter(b => timeStringToMinutes(b.start) > currentMins)
        .sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
    
    let nextConflictBlock = nextBlocks.find(b => b.type === "recreo" || b.type === "evento") || null;

    // Horario antes de la entrada (antes de las 8:15 AM)
    if (!currentBlock && currentMins < 495) { // 08:15 = 495 minutos
        return {
            rating: "success",
            label: "Óptimo",
            title: "Horario Previo a Clases",
            text: "Aún no inicia el primer bloque de clases de hoy. Gran ventana de tiempo para dejar todo limpio antes de la entrada de alumnos.",
            currentBlockName: "Antes de Clases",
            currentBlockTime: "00:00 - 08:15 hrs",
            currentBlockType: "libre",
            conflictZoneWarning: false,
            minutesToConflict: null,
            nextConflictName: "",
            isOptimalWindow: true
        };
    }

    if (!currentBlock) {
        currentBlock = { name: "Bloque Libre / Ventana", type: "libre", start: "08:15", end: "15:30" };
    }

    // A. RECREO O ALMUERZO ACTIVO (Alerta roja)
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
            conflictZoneWarning: true,
            minutesToConflict: 0,
            nextConflictName: currentBlock.name,
            isOptimalWindow: false
        };
    }

    // B. REGLA: BLOQUEO DE EFICIENCIA (Últimos 20 minutos de clases)
    if (currentBlock.type === "clase") {
        const blockEndMins = timeStringToMinutes(currentBlock.end);
        const minsRemaining = blockEndMins - currentMins;

        if (minsRemaining <= 20) {
            return {
                rating: "warning", // Naranja
                label: "Postponer",
                title: "Eficiencia de Aseo Baja",
                // Texto exacto de la regla de adenda
                text: "Sugerencia: Esperar a que termine el recreo para limpiar, la sala se ensuciará pronto",
                currentBlockName: currentBlock.name,
                currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
                currentBlockType: currentBlock.type,
                conflictZoneWarning: true, // Avisa de evitar limpieza
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
                text: `Los alumnos acaban de entrar a clases (${currentBlock.name}) y restan más de 20 minutos de clases. Limpiar ahora garantiza que se mantenga limpio.`,
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

    // D. HORARIO DE CLASE STANDARD (Intermedio: tras primeros 20 y antes de los últimos 20)
    if (currentBlock.type === "clase") {
        // Solapamiento de advertencia de 30 mins para el próximo recreo
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
            text: `Los alumnos están en clases (${currentBlock.name}). Buen momento para realizar limpieza silenciosa sin interrupciones directas.`,
            currentBlockName: currentBlock.name,
            currentBlockTime: `${currentBlock.start} - ${currentBlock.end} hrs`,
            currentBlockType: currentBlock.type,
            conflictZoneWarning: false,
            minutesToConflict: null,
            nextConflictName: "",
            isOptimalWindow: false
        };
    }

    return {
        rating: "success",
        label: "Óptimo",
        title: "Bloque Disponible",
        text: "No se registran clases activas ni recreos inminentes.",
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
    updateAccordionHeaders();
    updateActiveCycleDisplay();

    // Renderizadores Módulo 3
    renderPriorityList(timeStr);
    renderPodium();
    renderCriticalChart(timeStr);
    renderCalendarComponent();
}

// Actualiza el indicador visual de ciclo en el panel de marcado
function updateActiveCycleDisplay() {
    const cycleText = document.getElementById("marking-active-cycle-text");
    if (cycleText) {
        const cycleName = appState.activeSchedule === 1 ? "Primer Ciclo" : "Segundo Ciclo";
        cycleText.innerText = `Horario Activo: ${cycleName}`;
    }
}

// Sincroniza badges del header
function updateGlobalUIPills(optStatus) {
    const statusPill = document.getElementById("global-status-pill");
    const statusText = document.getElementById("global-status-text");

    statusPill.className = `status-indicator-pill ${optStatus.rating}`;
    statusText.innerText = optStatus.currentBlockName;

    const tabBadge = document.getElementById("optimizer-tab-badge");
    if (optStatus.conflictZoneWarning) {
        tabBadge.classList.remove("hidden");
    } else {
        tabBadge.classList.add("hidden");
    }
}

// Muestra/Oculta banner de conflicto
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
            title.innerText = `⚠️ Advertencia de Eficiencia de Aseo`;
            message.innerText = optStatus.text;
        }
    } else {
        banner.classList.add("hidden");
    }
}

// Módulo 1: Cuadrícula visual adaptada a categorías
function renderMarkingPanel(optStatus) {
    const salasGrid = document.getElementById("salas-grid");
    const canchasGrid = document.getElementById("canchas-grid");
    const banosGrid = document.getElementById("banos-grid");
    
    salasGrid.innerHTML = "";
    canchasGrid.innerHTML = "";
    banosGrid.innerHTML = "";

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
            classList.push("dirty");
        }

        // 2. Aplicar advertencia visual si es sala/baño y hay conflicto
        // (Nota: Baños y salas están expuestos a conflictos de recreo)
        if (optStatus.conflictZoneWarning && (zone.type === "sala" || zone.type === "bano")) {
            classList.push("warn-collision");
        }

        // 3. Asignar clases de color por piso/zona
        let floorLabel = "";
        if (zone.floor === 1) {
            classList.push("floor-1"); // Azul
            floorLabel = "1er Piso";
        } else if (zone.floor === 2) {
            classList.push("floor-2"); // Verde
            floorLabel = "2do Piso";
        } else if (zone.floor === 3) {
            classList.push("floor-3"); // Morado
            floorLabel = "3er Piso";
        } else {
            classList.push("floor-comun"); // Naranja
            floorLabel = zone.type === "cancha" ? "Exterior" : "Comunes";
        }

        btn.className = classList.join(" ");

        // Formatear timestamp
        let timeDisplay = "Sin registrar";
        if (zone.lastClean) {
            const cleanDate = new Date(zone.lastClean);
            const hrs = String(cleanDate.getHours()).padStart(2, '0');
            const mins = String(cleanDate.getMinutes()).padStart(2, '0');
            timeDisplay = `Aseo: ${hrs}:${mins} hrs`;
        }

        const statusLabel = isClean ? "Limpio" : "Requiere Aseo";
        const iconSvg = SVG_ICONS[zone.type] || "";

        // Layout estructurado para botones
        if (zone.type === "sala" || zone.type === "bano" || zone.type === "camarin") {
            btn.innerHTML = `
                <span class="floor-badge">${floorLabel}</span>
                <div class="zone-icon-wrapper">${iconSvg}</div>
                <span class="zone-name" style="margin-top: 4px;">${zone.name}</span>
                <span class="zone-status-pill" style="margin: 4px 0 2px 0;">${statusLabel}</span>
                <span class="zone-time">${timeDisplay}</span>
            `;
        } else {
            // Layout Canchas Deportivas (row flex)
            btn.innerHTML = `
                <span class="floor-badge">${floorLabel}</span>
                <div class="zone-details" style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                    <div class="zone-icon-wrapper" style="margin-bottom:0;">${iconSvg}</div>
                    <span class="zone-name">${zone.name}</span>
                </div>
                <div class="zone-time-status" style="margin-top: 8px;">
                    <span class="zone-status-pill">${statusLabel}</span>
                    <span class="zone-time" style="margin-top: 4px;">${timeDisplay}</span>
                </div>
            `;
        }

        // Clic
        btn.addEventListener("click", () => {
            markZoneAsClean(zone, optStatus);
        });

        // Distribuir en el acordeón correspondiente
        if (zone.type === "sala") {
            salasGrid.appendChild(btn);
        } else if (zone.type === "cancha") {
            canchasGrid.appendChild(btn);
        } else {
            banosGrid.appendChild(btn);
        }
    });
}

// Registro de marcajes de aseo
function markZoneAsClean(zone, optStatus) {
    const timestampStr = new Date().toISOString();
    let recordTimestamp = timestampStr;
    
    // Si el simulador está activo, simulamos el log en Mayo 28, 2026
    if (appState.isSimulatorOn) {
        const simDate = new Date(2026, 4, 28);
        const simMins = appState.simulatedMinutes;
        simDate.setHours(Math.floor(simMins / 60), simMins % 60, 0, 0);
        recordTimestamp = simDate.toISOString();
    }

    zone.lastClean = recordTimestamp;
    saveAseosToStorage();

    // Determinar la compliancia del marcaje
    let compliance = "success";
    if (optStatus.rating === "danger") {
        compliance = "danger";
    } else if (optStatus.rating === "warning") {
        compliance = "warning";
    }

    // Agregar entrada al registro histórico
    const newLog = {
        zoneId: zone.id,
        zoneName: zone.name,
        zoneType: zone.type,
        timestamp: recordTimestamp,
        operatorName: appState.activeOperator,
        compliance: compliance
    };
    appState.historyLogs.push(newLog);
    localStorage.setItem("san_nicolas_history_logs", JSON.stringify(appState.historyLogs));

    renderAll();

    const cleanDate = new Date(recordTimestamp);
    const hrs = String(cleanDate.getHours()).padStart(2, '0');
    const mins = String(cleanDate.getMinutes()).padStart(2, '0');

    if (optStatus.conflictZoneWarning && (zone.type === "sala" || zone.type === "bano")) {
        showToast(`⚠️ Registrado a las ${hrs}:${mins}. ${optStatus.text}`, "warning");
    } else if (optStatus.isOptimalWindow) {
        showToast(`✨ ¡Aseo óptimo! ${zone.name} marcado como LIMPIO a las ${hrs}:${mins} hrs por ${appState.activeOperator}.`, "success");
    } else {
        showToast(`✨ ${zone.name} marcado como LIMPIO a las ${hrs}:${mins} hrs por ${appState.activeOperator}.`, "success");
    }
}

// Renderiza contadores en cabecera de acordeones
function updateAccordionHeaders() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMins = startOfToday.getTime();

    // 1. Salas
    const salas = appState.zones.filter(z => z.type === "sala");
    const cleanSalas = salas.filter(z => z.lastClean && new Date(z.lastClean).getTime() >= todayMins).length;
    document.getElementById("acc-count-salas").innerText = `${cleanSalas} / 30 Limpias`;

    // 2. Canchas
    const canchas = appState.zones.filter(z => z.type === "cancha");
    const cleanCanchas = canchas.filter(z => z.lastClean && new Date(z.lastClean).getTime() >= todayMins).length;
    document.getElementById("acc-count-canchas").innerText = `${cleanCanchas} / 3 Limpias`;

    // 3. Baños/Camarines
    const banos = appState.zones.filter(z => z.type === "bano" || z.type === "camarin");
    const cleanBanos = banos.filter(z => z.lastClean && new Date(z.lastClean).getTime() >= todayMins).length;
    document.getElementById("acc-count-banos").innerText = `${cleanBanos} / 18 Limpios`;
}

// Módulo 2: Alertas y recomendaciones
function renderOptimizationDashboard(optStatus) {
    // 1. Actualizar Tarjeta de Resumen Actual
    const summaryCard = document.getElementById("opt-status-summary");
    
    let graphicRating = optStatus.rating;
    if (optStatus.label === "Favorable") {
        graphicRating = "success";
    }
    summaryCard.className = `glass-card status-summary-card ${optStatus.rating}`;
    
    document.getElementById("opt-current-block-type").innerText = optStatus.currentBlockType;
    document.getElementById("opt-current-block-name").innerText = optStatus.currentBlockName;
    document.getElementById("opt-current-block-time").innerText = optStatus.currentBlockTime;
    
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
            
            let blockRating = "success";
            let blockText = "Bloque de clases: Inicio ideal para limpiar.";
            let badgeLabel = "Óptimo";

            if (block.type === "recreo" || block.type === "evento") {
                blockRating = "danger";
                blockText = block.name === "Almuerzo" ? "Almuerzo activo: alumnos en casino." : "Recreo en curso: flujo masivo en salas.";
                badgeLabel = "Evitar";
            }

            const currentFormattedTime = getCurrentTimeFormatted();
            const currentMins = timeStringToMinutes(currentFormattedTime);
            const bStart = timeStringToMinutes(block.start);
            const bEnd = timeStringToMinutes(block.end);
            const isCurrent = currentMins >= bStart && currentMins < bEnd;

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

// Estadísticas rápidas en el header del Módulo 1
function updateQuickStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const cleanedTodayCount = appState.zones.filter(z => {
        return z.lastClean && new Date(z.lastClean).getTime() >= startOfToday.getTime();
    }).length;

    document.getElementById("stat-cleaned-count").innerText = cleanedTodayCount;
}

// 6. EVENTOS, NAVEGACIÓN Y SELECTOR DE HORARIOS
function setupEventListeners() {
    // A. Acordeón Toggle Listener
    document.querySelectorAll(".accordion-header").forEach(header => {
        header.addEventListener("click", (e) => {
            const item = e.currentTarget.parentElement;
            const isActive = item.classList.contains("active");
            
            if (isActive) {
                item.classList.remove("active");
            } else {
                document.querySelectorAll(".accordion-item").forEach(i => i.classList.remove("active"));
                item.classList.add("active");
            }
        });
    });

    // B. Selector de Horarios (Regular vs Especial)
    const btnSched1 = document.getElementById("btn-sched-1");
    const btnSched2 = document.getElementById("btn-sched-2");

    if (btnSched1 && btnSched2) {
        btnSched1.addEventListener("click", () => switchSchedule(1));
        btnSched2.addEventListener("click", () => switchSchedule(2));
    }

    // C. Navegación de Pestañas
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

    // D. Toggle del Simulador
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

    // Resetear registros
    document.getElementById("btn-reset-all-aseos").addEventListener("click", () => {
        if (confirm("¿Estás seguro de que deseas restablecer el historial de aseo de las 51 zonas? Esto borrará todos los registros actuales.")) {
            buildNewZonesState();
            renderAll();
            showToast("🔄 Historial de aseo reiniciado por completo.", "info");
        }
    });

    // Restaurar calendario académico
    document.getElementById("btn-restore-default-calendar").addEventListener("click", () => {
        if (confirm("¿Deseas restaurar la programación académica original del Colegio San Nicolás de Myra?")) {
            appState.calendar = appState.activeSchedule === 1 ? [...SCHEDULE_1] : [...SCHEDULE_2];
            saveCalendarToStorage();
            renderAll();
            showToast("📅 Programación escolar restaurada al diseño estándar.", "success");
        }
    });

    // Modales y Formularios
    document.getElementById("btn-add-block-modal").addEventListener("click", () => {
        openBlockModal();
    });

    document.getElementById("btn-cancel-modal").addEventListener("click", closeBlockModal);

    document.getElementById("block-form").addEventListener("submit", (e) => {
        e.preventDefault();
        saveBlockFromForm();
    });

    // Carga de Archivos JSON
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

    // Descargar Calendario
    document.getElementById("btn-download-calendar").addEventListener("click", downloadCalendarJson);

    // Módulo 3 Event Listeners
    // A. Selector de Operaria
    const operatorSelect = document.getElementById("operator-select");
    if (operatorSelect) {
        operatorSelect.value = appState.activeOperator;
        operatorSelect.addEventListener("change", (e) => {
            appState.activeOperator = e.target.value;
            showToast(`👤 Operaria activa cambiada a: ${appState.activeOperator}`, "info");
        });
    }

    // B. Navegación del Calendario
    const btnPrev = document.getElementById("btn-calendar-prev");
    const btnNext = document.getElementById("btn-calendar-next");
    if (btnPrev && btnNext) {
        btnPrev.addEventListener("click", () => {
            const current = appState.currentCalendarDate;
            appState.currentCalendarDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
            renderCalendarComponent();
        });
        btnNext.addEventListener("click", () => {
            const current = appState.currentCalendarDate;
            appState.currentCalendarDate = new Date(current.getFullYear(), current.getMonth() + 1, 1);
            renderCalendarComponent();
        });
    }

    // C. Generador y Modales de Informe
    const btnGenReport = document.getElementById("btn-generate-monthly-report");
    const btnCloseReport = document.getElementById("btn-close-report-modal");
    const btnPrintReport = document.getElementById("btn-print-report");

    if (btnGenReport) {
        btnGenReport.addEventListener("click", generateMonthlyReportModal);
    }
    if (btnCloseReport) {
        btnCloseReport.addEventListener("click", () => {
            document.getElementById("report-modal").classList.add("hidden");
        });
    }
    if (btnPrintReport) {
        btnPrintReport.addEventListener("click", () => {
            window.print();
        });
    }
}

// 7. INTERRUPTOR DE HORARIOS DIARIOS
function switchSchedule(type) {
    appState.activeSchedule = type;
    localStorage.setItem("san_nicolas_active_schedule", type);
    
    if (type === 1) {
        appState.calendar = [...SCHEDULE_1];
    } else {
        appState.calendar = [...SCHEDULE_2];
    }
    
    updateScheduleSelectorUI();
    saveCalendarToStorage();
    renderAll();
    
    const schedName = type === 1 ? "Primer Ciclo" : "Segundo Ciclo";
    showToast(`📅 Cambiado a Horario ${schedName} para hoy.`, "success");
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
        const block = appState.calendar[index];
        title.innerText = "Editar Bloque Académico";
        document.getElementById("edit-block-index").value = index;
        document.getElementById("block-name").value = block.name;
        document.getElementById("block-type").value = block.type;
        document.getElementById("block-start").value = block.start;
        document.getElementById("block-end").value = block.end;
    } else {
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

// ==========================================================================
// MÓDULO 3 - FUNCIONES DE PRIORIZACIÓN, HISTORIAL Y REPORTES
// ==========================================================================

// Generador de Logs Históricos de 30 días para localStorage
function generateMockHistoryLogs() {
    const logs = [];
    const operators = ["Tía María", "Tía Carmen", "Tía Rosa", "Tía Patricia"];
    const compliances = ["success", "success", "success", "warning", "danger"];
    const today = new Date(2026, 4, 28);
    
    const tempZones = [];
    for (let i = 1; i <= 30; i++) {
        tempZones.push({ id: `sala-${i}`, name: `Sala ${i}`, type: "sala" });
    }
    SPECIAL_ZONES.forEach((canchaName, index) => {
        tempZones.push({ id: `cancha-${index + 1}`, name: canchaName, type: "cancha" });
    });
    BANO_CAMARIN_DEFINITIONS.forEach((def, index) => {
        tempZones.push({ id: `bano-camarin-${index + 1}`, name: def.name, type: def.type });
    });

    // Generar ~240 registros
    for (let i = 0; i < 240; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const logDate = new Date(today.getTime());
        logDate.setDate(today.getDate() - daysAgo);
        
        const hour = 8 + Math.floor(Math.random() * 9);
        const minute = Math.floor(Math.random() * 60);
        logDate.setHours(hour, minute, 0, 0);
        
        let zoneIndex = Math.floor(Math.random() * tempZones.length);
        const r = Math.random();
        if (r < 0.08) {
            zoneIndex = tempZones.findIndex(z => z.id === "bano-camarin-1");
        } else if (r < 0.14) {
            zoneIndex = tempZones.findIndex(z => z.id === "sala-1");
        } else if (r < 0.19) {
            zoneIndex = tempZones.findIndex(z => z.id === "cancha-1");
        }
        
        const zone = tempZones[zoneIndex];
        const operatorName = operators[Math.floor(Math.random() * operators.length)];
        const compliance = compliances[Math.floor(Math.random() * compliances.length)];
        
        logs.push({
            zoneId: zone.id,
            zoneName: zone.name,
            zoneType: zone.type,
            timestamp: logDate.toISOString(),
            operatorName: operatorName,
            compliance: compliance
        });
    }

    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    appState.historyLogs = logs;
    localStorage.setItem("san_nicolas_history_logs", JSON.stringify(logs));
}

// Algoritmo de Priorización Dinámica
function calculateZonePriority(zone, timeStr) {
    const optStatus = getOptimizationStatus(timeStr);
    
    let inactivityHours = 8;
    if (zone.lastClean) {
        const timeDiffMs = Date.now() - new Date(zone.lastClean).getTime();
        inactivityHours = timeDiffMs / (1000 * 60 * 60);
    }
    
    // Adaptar inactividad en modo simulación
    if (appState.isSimulatorOn) {
        const simDate = new Date(2026, 4, 28);
        const simMins = appState.simulatedMinutes;
        simDate.setHours(Math.floor(simMins / 60), simMins % 60, 0, 0);
        
        if (zone.lastClean) {
            const timeDiffMs = simDate.getTime() - new Date(zone.lastClean).getTime();
            inactivityHours = timeDiffMs / (1000 * 60 * 60);
            if (inactivityHours < 0) inactivityHours = 0;
        } else {
            inactivityHours = 8;
        }
    }

    let score = inactivityHours * 10;
    
    // Peso de tráfico
    let trafficWeight = 0;
    if (zone.type === "bano" || zone.type === "camarin") {
        trafficWeight = 40;
    } else if (zone.type === "cancha") {
        trafficWeight = 25;
    }
    score += trafficWeight;
    
    // Ajuste de recreo (Próximo recreo en <= 30 mins)
    let recessAdjustment = 0;
    if (optStatus.conflictZoneWarning) {
        if (optStatus.minutesToConflict !== null && optStatus.minutesToConflict <= 30 && optStatus.rating === "warning") {
            if (zone.type === "bano" || zone.type === "camarin") {
                recessAdjustment = 50; // Urgencia alta de preparar baños antes
            } else if (zone.type === "sala") {
                recessAdjustment = -30; // Evitar limpiar salas
            }
        } else if (optStatus.rating === "danger") {
            if (zone.type === "bano" || zone.type === "camarin") {
                recessAdjustment = 20;
            } else if (zone.type === "sala") {
                recessAdjustment = -50;
            }
        }
    }
    score += recessAdjustment;
    score = Math.max(0, score);

    let rating = "low";
    if (score >= 85) {
        rating = "critical";
    } else if (score >= 45) {
        rating = "medium";
    }

    return {
        score: Math.round(score),
        rating,
        inactivityHours
    };
}

// Renderizar Lista Dinámica de Prioridades
function renderPriorityList(timeStr) {
    const container = document.getElementById("priority-list-container");
    if (!container) return;
    container.innerHTML = "";

    const prioritizedZones = appState.zones.map(zone => {
        const priority = calculateZonePriority(zone, timeStr);
        return { zone, priority };
    }).sort((a, b) => b.priority.score - a.priority.score);

    prioritizedZones.forEach((item, index) => {
        const zone = item.zone;
        const priority = item.priority;
        
        let inactivityDisplay = "Sin registrar";
        if (zone.lastClean) {
            const hrs = Math.floor(priority.inactivityHours);
            const mins = Math.floor((priority.inactivityHours % 1) * 60);
            inactivityDisplay = hrs > 0 ? `Hace ${hrs}h ${mins}m` : `Hace ${mins}m`;
        }

        const ratingLabels = {
            critical: "Crítica",
            medium: "Media",
            low: "Baja"
        };

        const itemDiv = document.createElement("div");
        itemDiv.className = `priority-item-card ${priority.rating}`;
        itemDiv.innerHTML = `
            <div class="priority-item-left">
                <div class="priority-number-badge">${index + 1}</div>
                <div class="priority-zone-info">
                    <span class="priority-zone-name">${zone.name}</span>
                    <span class="priority-zone-meta">${zone.type === "sala" ? "Sala" : (zone.type === "bano" ? "Baño" : "Camarín")} • ${inactivityDisplay}</span>
                </div>
            </div>
            <div class="priority-item-right">
                <span class="priority-score-pill">${ratingLabels[priority.rating]}: ${priority.score} pts</span>
                <button class="primary-btn btn-sm btn-priority-clean" data-id="${zone.id}" style="padding: 6px 10px; font-size: 0.72rem; border-radius: 8px;">✔ Limpiar</button>
            </div>
        `;
        
        itemDiv.querySelector(".btn-priority-clean").addEventListener("click", () => {
            const optStatus = getOptimizationStatus(timeStr);
            markZoneAsClean(zone, optStatus);
        });

        container.appendChild(itemDiv);
    });
}

// Renderizar Podio 3D de Excelencia
function renderPodium() {
    const podiumContainer = document.getElementById("excellence-podium");
    if (!podiumContainer) return;
    podiumContainer.innerHTML = "";

    const today = new Date(2026, 4, 28);
    if (appState.isSimulatorOn) {
        const simMins = appState.simulatedMinutes;
        today.setHours(Math.floor(simMins / 60), simMins % 60, 0, 0);
    }
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const counts = {};
    appState.historyLogs.forEach(log => {
        const logDate = new Date(log.timestamp);
        if (logDate >= sevenDaysAgo && logDate <= today) {
            counts[log.zoneId] = (counts[log.zoneId] || 0) + 1;
        }
    });

    const complianceList = appState.zones.map(zone => {
        return {
            id: zone.id,
            name: zone.name,
            type: zone.type,
            count: counts[zone.id] || 0
        };
    }).sort((a, b) => b.count - a.count);

    const top1 = complianceList[0] || { name: "Sin datos", count: 0, type: "sala" };
    const top2 = complianceList[1] || { name: "Sin datos", count: 0, type: "sala" };
    const top3 = complianceList[2] || { name: "Sin datos", count: 0, type: "sala" };

    const avatars = {
        sala: "🏫",
        cancha: "⚽",
        bano: "💧",
        camarin: "🚪"
    };

    // Segundo lugar
    const stand2 = document.createElement("div");
    stand2.className = "podium-stand second";
    stand2.innerHTML = `
        <div class="podium-avatar">${avatars[top2.type] || "🏫"}</div>
        <div class="podium-name">${top2.name}</div>
        <div class="podium-bar">
            <div class="podium-medal">2</div>
            <span class="podium-count">${top2.count}</span>
        </div>
    `;
    podiumContainer.appendChild(stand2);

    // Primer lugar
    const stand1 = document.createElement("div");
    stand1.className = "podium-stand first";
    stand1.innerHTML = `
        <div class="podium-avatar">${avatars[top1.type] || "🏫"}</div>
        <div class="podium-name">${top1.name}</div>
        <div class="podium-bar">
            <div class="podium-medal">1</div>
            <span class="podium-count">${top1.count}</span>
        </div>
    `;
    podiumContainer.appendChild(stand1);

    // Tercer lugar
    const stand3 = document.createElement("div");
    stand3.className = "podium-stand third";
    stand3.innerHTML = `
        <div class="podium-avatar">${avatars[top3.type] || "🏫"}</div>
        <div class="podium-name">${top3.name}</div>
        <div class="podium-bar">
            <div class="podium-medal">3</div>
            <span class="podium-count">${top3.count}</span>
        </div>
    `;
    podiumContainer.appendChild(stand3);
}

// Renderizar Gráfico de Barras de Zonas Críticas
function renderCriticalChart(timeStr) {
    const chartContainer = document.getElementById("critical-chart-container");
    if (!chartContainer) return;
    chartContainer.innerHTML = "";

    const zonesWithInactivity = appState.zones.map(zone => {
        let inactivityHours = 8;
        if (zone.lastClean) {
            let refDate = new Date();
            if (appState.isSimulatorOn) {
                refDate = new Date(2026, 4, 28);
                const simMins = appState.simulatedMinutes;
                refDate.setHours(Math.floor(simMins / 60), simMins % 60, 0, 0);
            }
            const timeDiffMs = refDate.getTime() - new Date(zone.lastClean).getTime();
            inactivityHours = Math.max(0, timeDiffMs / (1000 * 60 * 60));
        }
        return { zone, inactivityHours };
    }).sort((a, b) => b.inactivityHours - a.inactivityHours);

    const topCritical = zonesWithInactivity.slice(0, 5);

    topCritical.forEach(item => {
        const zone = item.zone;
        const hours = item.inactivityHours;
        
        let hoursDisplay = hours > 24 ? `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h` : `${Math.floor(hours)}h ${Math.floor((hours % 1) * 60)}m`;
        if (hours === 8 && !zone.lastClean) {
            hoursDisplay = "Nunca limpiado";
        }

        const pct = Math.min(100, (hours / 24) * 100);
        const barClass = hours >= 6 ? "danger" : "warning";

        const chartRow = document.createElement("div");
        chartRow.className = "chart-row";
        chartRow.innerHTML = `
            <div class="chart-row-header">
                <span class="chart-row-title">${zone.name}</span>
                <span class="chart-row-value">${hoursDisplay}</span>
            </div>
            <div class="chart-bar-bg">
                <div class="chart-bar-fill ${barClass}" style="width: ${pct}%;"></div>
            </div>
        `;
        chartContainer.appendChild(chartRow);
    });
}

// Renderizar Componente Calendario
function renderCalendarComponent() {
    const calendarGrid = document.getElementById("calendar-days-grid");
    const monthLabel = document.getElementById("calendar-month-year-label");
    if (!calendarGrid || !monthLabel) return;

    calendarGrid.innerHTML = "";

    const date = appState.currentCalendarDate;
    const year = date.getFullYear();
    const month = date.getMonth();

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    monthLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    // Rellenar días del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const paddingBtn = document.createElement("button");
        paddingBtn.className = "calendar-day-btn prev-month";
        paddingBtn.innerText = prevMonthTotalDays - i;
        calendarGrid.appendChild(paddingBtn);
    }

    // Detectar qué días tienen registros
    const logDaysSet = new Set();
    appState.historyLogs.forEach(log => {
        const logDate = new Date(log.timestamp);
        if (logDate.getFullYear() === year && logDate.getMonth() === month) {
            logDaysSet.add(logDate.getDate());
        }
    });

    // Renderizar días activos
    for (let day = 1; day <= totalDays; day++) {
        const dayBtn = document.createElement("button");
        dayBtn.className = "calendar-day-btn";
        dayBtn.innerText = day;

        const selected = appState.selectedLogDate;
        if (selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day) {
            dayBtn.classList.add("active");
        }

        if (logDaysSet.has(day)) {
            dayBtn.classList.add("has-logs");
        }

        dayBtn.addEventListener("click", () => {
            appState.selectedLogDate = new Date(year, month, day);
            renderCalendarComponent();
            renderSelectedDayLogs();
        });

        calendarGrid.appendChild(dayBtn);
    }

    // Rellenar días del mes siguiente (mantener cuadrícula de 42 celdas)
    const totalRendered = firstDayIndex + totalDays;
    const remainingPadding = 42 - totalRendered;
    for (let i = 1; i <= remainingPadding; i++) {
        const paddingBtn = document.createElement("button");
        paddingBtn.className = "calendar-day-btn next-month";
        paddingBtn.innerText = i;
        calendarGrid.appendChild(paddingBtn);
    }

    renderSelectedDayLogs();
}

// Renderizar bitácora del día seleccionado
function renderSelectedDayLogs() {
    const logList = document.getElementById("selected-day-logs");
    const label = document.getElementById("selected-day-label");
    const countBadge = document.getElementById("selected-day-count");
    if (!logList || !label || !countBadge) return;

    logList.innerHTML = "";

    const selected = appState.selectedLogDate;
    const day = selected.getDate();
    const month = selected.getMonth();
    const year = selected.getFullYear();

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    label.innerText = `Bitácora del ${day} de ${monthNames[month]}`;

    const dailyLogs = appState.historyLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate.getFullYear() === year && logDate.getMonth() === month && logDate.getDate() === day;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    countBadge.innerText = `${dailyLogs.length} ${dailyLogs.length === 1 ? 'registro' : 'registros'}`;

    if (dailyLogs.length === 0) {
        logList.innerHTML = `<div class="log-empty-msg">No hay registros de aseo para este día.</div>`;
        return;
    }

    const avatars = {
        sala: "🏫",
        cancha: "⚽",
        bano: "💧",
        camarin: "🚪"
    };

    const ratingLabels = {
        success: "Eficiente",
        warning: "Postponible",
        danger: "Riesgoso"
    };

    dailyLogs.forEach(log => {
        const logDate = new Date(log.timestamp);
        const hrsStr = String(logDate.getHours()).padStart(2, '0');
        const minsStr = String(logDate.getMinutes()).padStart(2, '0');

        const logCard = document.createElement("div");
        logCard.className = "log-card";
        logCard.innerHTML = `
            <div class="log-card-icon">${avatars[log.zoneType] || "🏫"}</div>
            <div class="log-card-body">
                <span class="log-card-title">${log.zoneName}</span>
                <span class="log-card-meta">A las ${hrsStr}:${minsStr} hrs por <strong>${log.operatorName || 'Operaria'}</strong></span>
                <span class="log-compliance-badge ${log.compliance}">${ratingLabels[log.compliance] || "Eficiente"}</span>
            </div>
        `;
        logList.appendChild(logCard);
    });
}

// Generador de Informe Mensual Modal Imprimible
function generateMonthlyReportModal() {
    const modal = document.getElementById("report-modal");
    const content = document.getElementById("printable-report-content");
    if (!modal || !content) return;

    const mayLogs = appState.historyLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate.getFullYear() === 2026 && logDate.getMonth() === 4;
    });

    const totalLimpiezas = mayLogs.length;
    const totalHours = Math.round(totalLimpiezas * 0.5);
    
    const successLogsCount = mayLogs.filter(log => log.compliance === "success").length;
    const complianceRate = totalLimpiezas > 0 ? Math.round((successLogsCount / totalLimpiezas) * 100) : 100;

    const operariasCount = {
        "Tía María": 0,
        "Tía Carmen": 0,
        "Tía Rosa": 0,
        "Tía Patricia": 0
    };
    mayLogs.forEach(log => {
        if (operariasCount[log.operatorName] !== undefined) {
            operariasCount[log.operatorName]++;
        }
    });

    const zoneCleanings = {};
    appState.zones.forEach(z => {
        zoneCleanings[z.id] = { name: z.name, count: 0, type: z.type, successCount: 0 };
    });

    mayLogs.forEach(log => {
        if (zoneCleanings[log.zoneId]) {
            zoneCleanings[log.zoneId].count++;
            if (log.compliance === "success") {
                zoneCleanings[log.zoneId].successCount++;
            }
        }
    });

    let tableRowsHtml = "";
    Object.values(zoneCleanings)
        .sort((a, b) => b.count - a.count)
        .forEach(item => {
            const zoneRate = item.count > 0 ? Math.round((item.successCount / item.count) * 100) : 100;
            let badgeClass = "success";
            if (zoneRate < 50) {
                badgeClass = "danger";
            } else if (zoneRate < 80) {
                badgeClass = "warning";
            }

            tableRowsHtml += `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td style="text-transform: capitalize;">${item.type === "sala" ? "Sala" : (item.type === "bano" ? "Baño" : "Camarín")}</td>
                    <td>${item.count} limpiezas</td>
                    <td>${item.count * 0.5} hrs</td>
                    <td><span class="report-doc-badge ${badgeClass}">${zoneRate}%</span></td>
                </tr>
            `;
        });

    content.innerHTML = `
        <div class="report-document">
            <div class="report-doc-header">
                <div class="report-doc-title-area">
                    <h2>Colegio San Nicolás de Myra</h2>
                    <p>Sistema de Optimización y Gestión de Aseo</p>
                </div>
                <div class="report-doc-meta">
                    <p>Reporte: <strong>Informe de Desempeño Mensual</strong></p>
                    <p>Período: <strong>Mayo 2026</strong></p>
                    <p>Fecha Emisión: <strong>28/05/2026</strong></p>
                </div>
            </div>
            
            <div class="report-doc-kpis">
                <div class="report-doc-kpi-card">
                    <div class="report-doc-kpi-lbl">Total Limpiezas</div>
                    <div class="report-doc-kpi-val">${totalLimpiezas}</div>
                </div>
                <div class="report-doc-kpi-card">
                    <div class="report-doc-kpi-lbl">Horas-Hombre Invertidas</div>
                    <div class="report-doc-kpi-val">${totalHours} hrs</div>
                </div>
                <div class="report-doc-kpi-card">
                    <div class="report-doc-kpi-lbl">Cumplimiento Horario</div>
                    <div class="report-doc-kpi-val success">${complianceRate}%</div>
                </div>
                <div class="report-doc-kpi-card">
                    <div class="report-doc-kpi-lbl">Operarias Activas</div>
                    <div class="report-doc-kpi-val" style="font-size: 1.15rem; margin-top:4px;">4 Operarias</div>
                </div>
            </div>
            
            <div class="report-doc-section-title">Resumen por Operaria de Aseo</div>
            <table class="report-doc-table">
                <thead>
                    <tr>
                        <th>Operaria de Aseo</th>
                        <th>Servicios Registrados</th>
                        <th>Tiempo de Limpieza Estimado</th>
                        <th>Desempeño Visual</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Tía María</strong></td>
                        <td>${operariasCount["Tía María"]} limpiezas</td>
                        <td>${operariasCount["Tía María"] * 0.5} horas</td>
                        <td><span class="report-doc-badge success">Excelente</span></td>
                    </tr>
                    <tr>
                        <td><strong>Tía Carmen</strong></td>
                        <td>${operariasCount["Tía Carmen"]} limpiezas</td>
                        <td>${operariasCount["Tía Carmen"] * 0.5} horas</td>
                        <td><span class="report-doc-badge success">Excelente</span></td>
                    </tr>
                    <tr>
                        <td><strong>Tía Rosa</strong></td>
                        <td>${operariasCount["Tía Rosa"]} limpiezas</td>
                        <td>${operariasCount["Tía Rosa"] * 0.5} horas</td>
                        <td><span class="report-doc-badge success">Excelente</span></td>
                    </tr>
                    <tr>
                        <td><strong>Tía Patricia</strong></td>
                        <td>${operariasCount["Tía Patricia"]} limpiezas</td>
                        <td>${operariasCount["Tía Patricia"] * 0.5} horas</td>
                        <td><span class="report-doc-badge success">Excelente</span></td>
                    </tr>
                </tbody>
            </table>

            <div class="report-doc-section-title">Desglose Detallado por Zona de Infraestructura</div>
            <table class="report-doc-table">
                <thead>
                    <tr>
                        <th>Zona / Sala / Baño</th>
                        <th>Tipo</th>
                        <th>Total Limpiezas</th>
                        <th>Horas Invertidas</th>
                        <th>% Cumplimiento Horario</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
            
            <div class="report-doc-footer">
                <p>Generado por el módulo de analítica inteligente del Colegio San Nicolás de Myra.</p>
                <p>Página 1 de 1</p>
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
}
