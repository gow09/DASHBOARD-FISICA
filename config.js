// ============================================
// CONFIG.JS - Dashboard con Escenarios
// ============================================
const CONFIG = {
  SERVER_URL: "http://127.0.0.1:5000",
  INTERVALO_MS: 1000,
  MAX_FILAS_TABLA: 10,
  MAX_PUNTOS_GRAFICA: 60
};

const Estado = {
  ultimoValor: { voltaje: null, corriente: null, potencia: null },
  contadorMuestras: 0,
  charts: {},
  modalChart: null,
  chartActual: null,
  escenarioActual: 'estable',
  historialCompleto: {
    tiempo: [], voltaje: [], corriente: [], potencia: [], bateria: []
  }
};

// ============================================
// CONFIGURACIÓN BASE DE CHART.JS
// ============================================
function opcionesBase(unidad, color) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 20, 25, 0.95)',
        borderColor: color,
        borderWidth: 1,
        titleColor: color,
        bodyColor: '#f1f5f9',
        padding: 10,
        displayColors: false,
        callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(2)} ${unidad}` }
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 9 }, maxTicksLimit: 6 }
      }
    },
    elements: { point: { radius: 0, hoverRadius: 5 } }
  };
}

// ============================================
// CREAR GRÁFICAS
// ============================================
function crearGraficas() {
  const charts = [
    { id: 'chartVoltaje', key: 'voltaje', color: '#3b82f6', unidad: 'V' },
    { id: 'chartCorriente', key: 'corriente', color: '#10b981', unidad: 'mA' },
    { id: 'chartPotencia', key: 'potencia', color: '#f59e0b', unidad: 'mW' },
    { id: 'chartBateria', key: 'bateria', color: '#a855f7', unidad: '%' }
  ];

  charts.forEach(cfg => {
    const ctx = document.getElementById(cfg.id).getContext('2d');
    Estado.charts[cfg.key] = new Chart(ctx, {
      type: cfg.key === 'corriente' ? 'bar' : 'line',
      data: {
        labels: [],
        datasets: [{
          label: cfg.key,
          data: [],
          borderColor: cfg.color,
          backgroundColor: cfg.key === 'corriente'
            ? (ctx) => ctx.raw > 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'
            : cfg.color + '20',
          borderWidth: 2,
          fill: cfg.key !== 'corriente',
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5
        }]
      },
      options: opcionesBase(cfg.unidad, cfg.color)
    });
  });
}

// ============================================
// ACTUALIZAR GRÁFICAS
// ============================================
function actualizarGraficas(historial) {
  if (!historial || !historial.tiempo) return;
  Estado.historialCompleto = historial;
  
  const max = CONFIG.MAX_PUNTOS_GRAFICA;
  const inicio = Math.max(0, historial.tiempo.length - max);
  const labels = historial.tiempo.slice(inicio);
  
  const configs = [
    { key: 'voltaje', data: historial.voltaje.slice(inicio) },
    { key: 'corriente', data: historial.corriente.slice(inicio) },
    { key: 'potencia', data: historial.potencia.slice(inicio) },
    { key: 'bateria', data: historial.bateria.slice(inicio) }
  ];
  
  configs.forEach(cfg => {
    const chart = Estado.charts[cfg.key];
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = cfg.data;
    if (cfg.key === 'corriente') {
      chart.data.datasets[0].backgroundColor = cfg.data.map(v =>
        v > 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'
      );
    }
    chart.update('none');
  });
  
  if (Estado.modalChart && Estado.chartActual) actualizarModal();
}

// ============================================
// MODAL
// ============================================
function abrirModal(tipo) {
  const modal = document.getElementById('modal');
  const titulos = { voltaje: 'Voltaje', corriente: 'Corriente', potencia: 'Potencia', bateria: 'Nivel de Batería' };
  const unidades = { voltaje: 'V', corriente: 'mA', potencia: 'mW', bateria: '%' };
  const colores = { voltaje: '#3b82f6', corriente: '#10b981', potencia: '#f59e0b', bateria: '#a855f7' };
  
  document.getElementById('modalTitle').textContent = titulos[tipo] + ' — Análisis Detallado';
  Estado.chartActual = tipo;
  
  if (Estado.modalChart) Estado.modalChart.destroy();
  
  const ctx = document.getElementById('modalChart').getContext('2d');
  const datos = Estado.historialCompleto[tipo] || [];
  const labels = Estado.historialCompleto.tiempo || [];
  
  Estado.modalChart = new Chart(ctx, {
    type: tipo === 'corriente' ? 'bar' : 'line',
    data: {
      labels: labels,
      datasets: [{
        label: titulos[tipo],
        data: datos,
        borderColor: colores[tipo],
        backgroundColor: tipo === 'corriente'
          ? datos.map(v => v > 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)')
          : colores[tipo] + '30',
        borderWidth: 3,
        fill: tipo !== 'corriente',
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, labels: { color: '#f1f5f9' } },
        tooltip: {
          backgroundColor: 'rgba(15, 20, 25, 0.95)',
          borderColor: colores[tipo], borderWidth: 1,
          titleColor: colores[tipo], bodyColor: '#f1f5f9', padding: 12,
          callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(2)} ${unidades[tipo]}` }
        }
      },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } }
      },
      elements: { point: { radius: 2, hoverRadius: 6 } }
    }
  });
  
  actualizarModalStats(tipo, datos, unidades[tipo]);
  modal.classList.add('active');
}

function actualizarModalStats(tipo, datos, unidad) {
  const stats = document.getElementById('modalStats');
  if (!datos || datos.length === 0) {
    stats.innerHTML = '<p style="color: #94a3b8;">Sin datos disponibles</p>';
    return;
  }
  const nums = datos.map(Number);
  const prom = nums.reduce((a, b) => a + b, 0) / nums.length;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const ultimo = nums[nums.length - 1];
  const varianza = nums.reduce((a, b) => a + Math.pow(b - prom, 2), 0) / nums.length;
  const std = Math.sqrt(varianza);
  
  stats.innerHTML = `
    <div class="modal-stat"><div class="modal-stat-label">Último</div><div class="modal-stat-value">${ultimo.toFixed(2)} ${unidad}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Promedio</div><div class="modal-stat-value">${prom.toFixed(2)} ${unidad}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Máximo</div><div class="modal-stat-value">${max.toFixed(2)} ${unidad}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Mínimo</div><div class="modal-stat-value">${min.toFixed(2)} ${unidad}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Desv. Est.</div><div class="modal-stat-value">${std.toFixed(3)} ${unidad}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Muestras</div><div class="modal-stat-value">${nums.length}</div></div>
  `;
}

function actualizarModal() {
  if (!Estado.chartActual || !Estado.modalChart) return;
  const tipo = Estado.chartActual;
  const datos = Estado.historialCompleto[tipo] || [];
  Estado.modalChart.data.labels = Estado.historialCompleto.tiempo || [];
  Estado.modalChart.data.datasets[0].data = datos;
  if (tipo === 'corriente') {
    Estado.modalChart.data.datasets[0].backgroundColor = datos.map(v =>
      v > 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'
    );
  }
  Estado.modalChart.update('none');
  const unidades = { voltaje: 'V', corriente: 'mA', potencia: 'mW', bateria: '%' };
  actualizarModalStats(tipo, datos, unidades[tipo]);
}

function cerrarModal() {
  document.getElementById('modal').classList.remove('active');
  if (Estado.modalChart) { Estado.modalChart.destroy(); Estado.modalChart = null; }
  Estado.chartActual = null;
}

// ============================================
// ESTADO DEL SISTEMA
// ============================================
function actualizarEstadoSistema(datos) {
  const banner = document.getElementById('systemStatus');
  const icon = document.getElementById('systemStatusIcon');
  const title = document.getElementById('systemStatusTitle');
  const desc = document.getElementById('systemStatusDesc');
  const badge = document.getElementById('systemStatusBadge');
  
  // Limpiar clases anteriores
  banner.className = 'system-status';
  
  const estado = datos.estado_sistema || 'DESCARGANDO';
  
  const configs = {
    'CARGANDO': { clase: 'status-cargando', icon: '🔌', color: '#10b981' },
    'DESCARGANDO': { clase: 'status-descargando', icon: '🔋', color: '#f59e0b' },
    'CRÍTICO': { clase: 'status-critico', icon: '⚠️', color: '#ef4444' },
    'BAJO': { clase: 'status-bajo', icon: '🪫', color: '#f59e0b' },
    'LLENO': { clase: 'status-lleno', icon: '✅', color: '#10b981' },
    'ESTABLE': { clase: 'status-estable', icon: '⚖️', color: '#3b82f6' }
  };
  
  const cfg = configs[estado] || configs['DESCARGANDO'];
  banner.classList.add(cfg.clase);
  icon.textContent = cfg.icon;
  title.textContent = datos.escenario_nombre || 'Sistema';
  desc.textContent = datos.escenario_descripcion || '';
  badge.textContent = estado;
}

// ============================================
// ESCENARIOS
// ============================================
async function cargarEscenarios() {
  try {
    const res = await fetch(`${CONFIG.SERVER_URL}/api/escenarios`);
    const data = await res.json();
    Estado.escenarioActual = data.actual;
    renderizarEscenarios(data.escenarios, data.actual);
  } catch (e) {
    console.error('Error cargando escenarios:', e);
  }
}

function renderizarEscenarios(escenarios, actual) {
  const lista = document.getElementById('scenariosList');
  lista.innerHTML = '';
  
  escenarios.forEach(esc => {
    const item = document.createElement('div');
    item.className = 'scenario-item' + (esc.id === actual ? ' active' : '');
    item.innerHTML = `
      <div class="scenario-color" style="background: ${esc.color}; color: ${esc.color};"></div>
      <div class="scenario-info">
        <div class="scenario-name">${esc.nombre}</div>
        <div class="scenario-desc">${esc.descripcion}</div>
      </div>
      <div class="scenario-check">✓</div>
    `;
    item.addEventListener('click', () => cambiarEscenario(esc.id));
    lista.appendChild(item);
  });
}

async function cambiarEscenario(nombre) {
  try {
    const res = await fetch(`${CONFIG.SERVER_URL}/api/escenario/${nombre}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      Estado.escenarioActual = nombre;
      await cargarEscenarios();
      // Cerrar panel tras un pequeño delay
      setTimeout(() => cerrarPanelEscenarios(), 400);
    }
  } catch (e) {
    console.error('Error cambiando escenario:', e);
  }
}

async function limpiarHistorial() {
  try {
    await fetch(`${CONFIG.SERVER_URL}/api/historial/limpiar`, { method: 'POST' });
    Estado.contadorMuestras = 0;
    Estado.historialCompleto = { tiempo: [], voltaje: [], corriente: [], potencia: [], bateria: [] };
    document.getElementById('tablaBody').innerHTML = '<tr><td colspan="7" class="empty">Historial limpiado...</td></tr>';
  } catch (e) {
    console.error('Error limpiando historial:', e);
  }
}

function abrirPanelEscenarios() {
  document.getElementById('scenariosPanel').classList.add('active');
}

function cerrarPanelEscenarios() {
  document.getElementById('scenariosPanel').classList.remove('active');
}

// ============================================
// RESTO DE FUNCIONES (igual que antes)
// ============================================
function actualizarEstado(conectado) {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  if (conectado) {
    indicator.className = 'status-badge online';
    statusText.textContent = 'Conectado';
  } else {
    indicator.className = 'status-badge offline';
    statusText.textContent = 'Desconectado';
  }
}

function actualizarTendencia(elementId, clave, valorActual) {
  const el = document.getElementById(elementId);
  const anterior = Estado.ultimoValor[clave];
  if (anterior !== null && anterior !== 0) {
    const diff = valorActual - anterior;
    const porcentaje = (diff / Math.abs(anterior)) * 100;
    if (diff > 0.01) { el.textContent = `↑ +${porcentaje.toFixed(1)}%`; el.className = 'metric-trend up'; }
    else if (diff < -0.01) { el.textContent = `↓ ${porcentaje.toFixed(1)}%`; el.className = 'metric-trend down'; }
    else { el.textContent = '→ Estable'; el.className = 'metric-trend'; }
  }
  Estado.ultimoValor[clave] = valorActual;
}

function actualizarMetricas(datos) {
  document.getElementById('voltaje').textContent = datos.voltaje_V.toFixed(2);
  document.getElementById('corriente').textContent = datos.corriente_mA.toFixed(1);
  document.getElementById('potencia').textContent = datos.potencia_mW.toFixed(1);
  actualizarTendencia('trendVoltaje', 'voltaje', datos.voltaje_V);
  actualizarTendencia('trendCorriente', 'corriente', datos.corriente_mA);
  actualizarTendencia('trendPotencia', 'potencia', datos.potencia_mW);
  
  const estadoEl = document.getElementById('estado');
  const estadoIcon = document.getElementById('estadoIcon');
  const trendEstado = document.getElementById('trendEstado');
  
  if (datos.cargando) {
    estadoEl.textContent = 'CARGANDO';
    estadoEl.style.color = '#10b981';
    trendEstado.textContent = '↑ Corriente positiva';
    trendEstado.className = 'metric-trend up';
  } else {
    estadoEl.textContent = 'DESCARGANDO';
    estadoEl.style.color = '#f59e0b';
    estadoIcon.textContent = '🔋';
    trendEstado.textContent = '↓ Corriente negativa';
    trendEstado.className = 'metric-trend down';
  }
  document.getElementById('ultimaActualizacion').textContent = new Date().toLocaleTimeString();
}

function actualizarBateria(datos) {
  document.getElementById('batteryFill').style.width = datos.nivel_bateria + '%';
  document.getElementById('batteryPercent').textContent = datos.nivel_bateria.toFixed(1) + '%';
  document.getElementById('batteryVoltaje').textContent = datos.voltaje_V.toFixed(2) + ' V';
  document.getElementById('batteryEstado').textContent = datos.cargando ? 'Cargando' : 'Descargando';
  document.getElementById('batteryEstado').style.color = datos.cargando ? '#10b981' : '#f59e0b';
  
  if (!datos.cargando && datos.corriente_mA < 0) {
    const consumo = Math.abs(datos.corriente_mA);
    if (consumo > 0) {
      const capRestante = (datos.nivel_bateria / 100) * 2500;
      const minutos = (capRestante / consumo) * 60;
      document.getElementById('tiempoRestante').textContent = 
        minutos > 60 ? (minutos / 60).toFixed(1) + ' h' : minutos.toFixed(0) + ' min';
    }
  } else {
    document.getElementById('tiempoRestante').textContent = '—';
  }
}

function actualizarEstadisticas(historial) {
  if (!historial || !historial.voltaje || historial.voltaje.length === 0) return;
  const v = historial.voltaje, i = historial.corriente, p = historial.potencia;
  const prom = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  document.getElementById('statVoltajeProm').textContent = prom(v).toFixed(3) + ' V';
  document.getElementById('statVoltajeMaxMin').textContent = 
    Math.max(...v).toFixed(2) + ' / ' + Math.min(...v).toFixed(2) + ' V';
  document.getElementById('statCorrienteProm').textContent = prom(i).toFixed(1) + ' mA';
  document.getElementById('statPotenciaProm').textContent = prom(p).toFixed(1) + ' mW';
  document.getElementById('statMuestras').textContent = v.length;
}

function actualizarTabla(datos) {
  const tbody = document.getElementById('tablaBody');
  const hora = new Date().toLocaleTimeString();
  if (tbody.querySelector('.empty')) tbody.innerHTML = '';
  Estado.contadorMuestras++;
  const fila = document.createElement('tr');
  fila.innerHTML = `
    <td>${Estado.contadorMuestras}</td>
    <td>${hora}</td>
    <td>${datos.voltaje_V.toFixed(3)}</td>
    <td>${datos.corriente_mA.toFixed(2)}</td>
    <td>${datos.potencia_mW.toFixed(2)}</td>
    <td style="color: ${datos.cargando ? '#10b981' : '#f59e0b'}; font-weight: 700;">
      ${datos.cargando ? 'Cargando' : 'Descargando'}
    </td>
    <td>${datos.nivel_bateria.toFixed(1)}%</td>
  `;
  tbody.insertBefore(fila, tbody.firstChild);
  while (tbody.children.length > CONFIG.MAX_FILAS_TABLA) tbody.removeChild(tbody.lastChild);
}

function actualizarValoresGraficas(datos) {
  document.getElementById('chartVoltajeActual').textContent = datos.voltaje_V.toFixed(2) + ' V';
  document.getElementById('chartCorrienteActual').textContent = datos.corriente_mA.toFixed(1) + ' mA';
  document.getElementById('chartPotenciaActual').textContent = datos.potencia_mW.toFixed(1) + ' mW';
  document.getElementById('chartBateriaActual').textContent = datos.nivel_bateria.toFixed(1) + ' %';
}

// ============================================
// ACTUALIZACIÓN PRINCIPAL
// ============================================
async function actualizar() {
  try {
    const res = await fetch(`${CONFIG.SERVER_URL}/api/datos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const datos = await res.json();
    if (datos.error) throw new Error(datos.error);
    
    actualizarEstado(true);
    actualizarEstadoSistema(datos);
    actualizarMetricas(datos);
    actualizarBateria(datos);
    actualizarValoresGraficas(datos);
    actualizarTabla(datos);
    
    if (datos.historial) {
      actualizarGraficas(datos.historial);
      actualizarEstadisticas(datos.historial);
    }
  } catch (error) {
    console.error('Error:', error);
    actualizarEstado(false);
  }
}

// ============================================
// INICIALIZAR
// ============================================
window.onload = () => {
  document.getElementById('intervalo').textContent = CONFIG.INTERVALO_MS;
  crearGraficas();
  
  // Modal
  document.querySelectorAll('.chart-card').forEach(card => {
    card.addEventListener('click', () => abrirModal(card.dataset.chart));
  });
  document.getElementById('modalClose').addEventListener('click', cerrarModal);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') cerrarModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { cerrarModal(); cerrarPanelEscenarios(); }
  });
  
  // Panel de escenarios
  document.getElementById('scenariosToggle').addEventListener('click', () => {
    const panel = document.getElementById('scenariosPanel');
    if (panel.classList.contains('active')) cerrarPanelEscenarios();
    else { abrirPanelEscenarios(); cargarEscenarios(); }
  });
  document.getElementById('scenariosClose').addEventListener('click', cerrarPanelEscenarios);
  document.getElementById('btnLimpiar').addEventListener('click', limpiarHistorial);
  
  // Cerrar panel al hacer click fuera
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('scenariosPanel');
    const toggle = document.getElementById('scenariosToggle');
    if (panel.classList.contains('active') && 
        !panel.contains(e.target) && 
        !toggle.contains(e.target)) {
      cerrarPanelEscenarios();
    }
  });
  
  // Cargar escenarios
  cargarEscenarios();
  
  console.log('🚀 Dashboard iniciado');
  actualizar();
  setInterval(actualizar, CONFIG.INTERVALO_MS);
};