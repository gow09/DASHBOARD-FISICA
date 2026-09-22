# ============================================
# MAIN.PY - Servidor + Simulador con Escenarios
# ============================================
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import requests
import math
import random
from datetime import datetime
from collections import deque

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# ============================================
# CONFIGURACIÓN
# ============================================
USAR_SIMULADOR = True
ESP32_IP = "192.168.43.50"
ESP32_PORT = 80
MAX_PUNTOS = 120

# ============================================
# HISTORIAL
# ============================================
historial = {
    'tiempo': deque(maxlen=MAX_PUNTOS),
    'voltaje': deque(maxlen=MAX_PUNTOS),
    'corriente': deque(maxlen=MAX_PUNTOS),
    'potencia': deque(maxlen=MAX_PUNTOS),
    'bateria': deque(maxlen=MAX_PUNTOS),
    'estado': deque(maxlen=MAX_PUNTOS)
}

# ============================================
# ESCENARIOS DISPONIBLES
# ============================================
ESCENARIOS = {
    'estable': {
        'nombre': 'Sistema Estable',
        'descripcion': 'Batería cargada, consumo mínimo, panel mantiene carga',
        'nivel_inicial': 85,
        'delta_base': 0.05,
        'corriente_base': 15,
        'variacion': 8,
        'color': '#3b82f6'
    },
    'descarga_lenta': {
        'nombre': 'Descarga Lenta',
        'descripcion': 'Sin sol, consumo bajo (solo ESP32)',
        'nivel_inicial': 70,
        'delta_base': -0.4,
        'corriente_base': -120,
        'variacion': 15,
        'color': '#f59e0b'
    },
    'descarga_rapida': {
        'nombre': 'Descarga Rápida',
        'descripcion': 'Sin sol, todos los LEDs encendidos',
        'nivel_inicial': 55,
        'delta_base': -1.2,
        'corriente_base': -380,
        'variacion': 25,
        'color': '#ef4444'
    },
    'carga_solar': {
        'nombre': 'Carga Solar Normal',
        'descripcion': 'Sol moderado, panel cargando batería',
        'nivel_inicial': 45,
        'delta_base': 0.8,
        'corriente_base': 280,
        'variacion': 20,
        'color': '#10b981'
    },
    'carga_rapida': {
        'nombre': 'Carga Solar Rápida',
        'descripcion': 'Sol fuerte, carga máxima del panel',
        'nivel_inicial': 30,
        'delta_base': 1.5,
        'corriente_base': 450,
        'variacion': 30,
        'color': '#10b981'
    },
    'noche': {
        'nombre': 'Noche (Sin Sol)',
        'descripcion': 'Panel inactivo, batería alimentando el sistema',
        'nivel_inicial': 60,
        'delta_base': -0.3,
        'corriente_base': -80,
        'variacion': 10,
        'color': '#64748b'
    },
    'critico': {
        'nombre': 'Nivel Crítico',
        'descripcion': 'Batería baja, advertencia de apagado',
        'nivel_inicial': 15,
        'delta_base': -0.8,
        'corriente_base': -250,
        'variacion': 20,
        'color': '#ef4444'
    },
    'nublado': {
        'nombre': 'Día Nublado',
        'descripcion': 'Poca luz solar, carga intermitente',
        'nivel_inicial': 50,
        'delta_base': 0.1,
        'corriente_base': 40,
        'variacion': 60,
        'color': '#94a3b8'
    },
    'pico_consumo': {
        'nombre': 'Pico de Consumo',
        'descripcion': 'Todos los LEDs + carga extra activada',
        'nivel_inicial': 65,
        'delta_base': -1.8,
        'corriente_base': -520,
        'variacion': 40,
        'color': '#ef4444'
    }
}

# ============================================
# SIMULADOR CON ESCENARIOS
# ============================================
class Simulador:
    def __init__(self):
        self.inicio = datetime.now()
        self.escenario_actual = 'estable'
        self.nivel_bateria = ESCENARIOS['estable']['nivel_inicial']
        self.ultimo_voltaje = 3.85
        self.ultima_corriente = 15
        self.tiempo_inicio_escenario = 0
        self.auto_ciclo = False  # Si es True, cambia escenarios automáticamente
    
    def cambiar_escenario(self, nombre):
        """Cambia el escenario activo."""
        if nombre in ESCENARIOS:
            self.escenario_actual = nombre
            self.nivel_bateria = ESCENARIOS[nombre]['nivel_inicial']
            self.tiempo_inicio_escenario = (datetime.now() - self.inicio).total_seconds()
            return True
        return False
    
    def obtener_datos(self):
        t = (datetime.now() - self.inicio).total_seconds()
        t_escenario = t - self.tiempo_inicio_escenario
        
        esc = ESCENARIOS[self.escenario_actual]
        
        # Delta de nivel por segundo (convertido a por tick de 1s)
        delta_por_segundo = esc['delta_base'] / 60.0  # Ajuste para que 1% = 1 min
        
        # Aplicar cambio al nivel
        self.nivel_bateria += delta_por_segundo
        self.nivel_bateria = max(0, min(100, self.nivel_bateria))
        
        # Voltaje basado en nivel
        voltaje_base = 3.0 + (self.nivel_bateria / 100.0) * 1.2
        
        # Variación natural
        variacion_v = math.sin(t * 0.4) * 0.015 + random.uniform(-0.008, 0.008)
        voltaje = voltaje_base + variacion_v
        voltaje = max(3.0, min(4.2, voltaje))
        
        # Corriente según escenario
        corriente_objetivo = esc['corriente_base'] + math.sin(t * 0.5) * esc['variacion']
        self.ultima_corriente += (corriente_objetivo - self.ultima_corriente) * 0.2
        corriente = self.ultima_corriente + random.uniform(-5, 5)
        
        # Potencia
        potencia = voltaje * corriente
        
        # Estado de carga
        cargando = corriente > 0
        
        # Detección de estado del sistema
        if self.nivel_bateria < 10:
            estado_sistema = 'CRÍTICO'
        elif self.nivel_bateria < 25:
            estado_sistema = 'BAJO'
        elif cargando and self.nivel_bateria > 95:
            estado_sistema = 'LLENO'
        elif cargando:
            estado_sistema = 'CARGANDO'
        else:
            estado_sistema = 'DESCARGANDO'
        
        return {
            "timestamp": int(t * 1000),
            "device_id": "simulador-01",
            "sensor": "INA219",
            "punto_medicion": "bateria",
            "voltaje_V": round(voltaje, 3),
            "corriente_mA": round(corriente, 2),
            "potencia_mW": round(potencia, 2),
            "voltaje_shunt_mV": round(corriente * 0.1, 3),
            "cargando": cargando,
            "nivel_bateria": round(self.nivel_bateria, 2),
            "escenario": self.escenario_actual,
            "escenario_nombre": esc['nombre'],
            "escenario_descripcion": esc['descripcion'],
            "estado_sistema": estado_sistema
        }

simulador = Simulador()

# ============================================
# RUTAS
# ============================================
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

@app.route('/api/datos')
def obtener_datos():
    try:
        if USAR_SIMULADOR:
            datos = simulador.obtener_datos()
        else:
            url = f'http://{ESP32_IP}:{ESP32_PORT}/datos'
            r = requests.get(url, timeout=3)
            datos = r.json()
            datos['escenario'] = 'real'
            datos['escenario_nombre'] = 'ESP32 Real'
            datos['escenario_descripcion'] = 'Datos del hardware real'
            datos['estado_sistema'] = 'ACTIVO'
        
        ahora = datetime.now()
        historial['tiempo'].append(ahora.strftime('%H:%M:%S'))
        historial['voltaje'].append(datos['voltaje_V'])
        historial['corriente'].append(datos['corriente_mA'])
        historial['potencia'].append(datos['potencia_mW'])
        historial['bateria'].append(datos['nivel_bateria'])
        historial['estado'].append(1 if datos['cargando'] else -1)
        
        datos['historial'] = {
            'tiempo': list(historial['tiempo']),
            'voltaje': list(historial['voltaje']),
            'corriente': list(historial['corriente']),
            'potencia': list(historial['potencia']),
            'bateria': list(historial['bateria'])
        }
        
        return jsonify(datos)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/escenarios')
def obtener_escenarios():
    """Devuelve la lista de escenarios disponibles."""
    lista = []
    for key, val in ESCENARIOS.items():
        lista.append({
            'id': key,
            'nombre': val['nombre'],
            'descripcion': val['descripcion'],
            'color': val['color']
        })
    return jsonify({
        'escenarios': lista,
        'actual': simulador.escenario_actual
    })

@app.route('/api/escenario/<nombre>', methods=['POST'])
def cambiar_escenario(nombre):
    """Cambia el escenario activo."""
    if simulador.cambiar_escenario(nombre):
        return jsonify({
            'success': True,
            'escenario': nombre,
            'nombre': ESCENARIOS[nombre]['nombre']
        })
    return jsonify({'error': 'Escenario no encontrado'}), 404

@app.route('/api/historial/limpiar', methods=['POST'])
def limpiar_historial():
    """Limpia el historial para empezar de cero."""
    for key in historial:
        historial[key].clear()
    simulador.nivel_bateria = ESCENARIOS[simulador.escenario_actual]['nivel_inicial']
    return jsonify({'success': True})

# ============================================
# INICIO
# ============================================
if __name__ == '__main__':
    modo = "🎭 SIMULADOR" if USAR_SIMULADOR else f"📡 ESP32 ({ESP32_IP})"
    print("=" * 55)
    print("🚀 Servidor Dashboard Fotovoltaico")
    print("=" * 55)
    print(f"📊 Modo: {modo}")
    print(f"🌐 Dashboard: http://127.0.0.1:5000")
    print(f" Escenarios disponibles: {len(ESCENARIOS)}")
    print("=" * 55)
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)