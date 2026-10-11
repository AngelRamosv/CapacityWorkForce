# 🏆 Capacity WFM (WorkForce Management)

Plataforma operativa Full-Stack para la gestión de capacidad, simulación de dotaciones y monitoreo en tiempo real de operaciones de Call Center.

Diseñada bajo la metodología **Spec-Driven Development (SDD)**: el comportamiento y validaciones del software están gobernados estrictamente por las especificaciones en `specs/`.

---

## 📁 Estructura del Repositorio (Spec-Driven Architecture)

```text
WorkForce/
├── client/                     # Frontend React 19 + TypeScript + Vite + Tailwind CSS
├── server/                     # Backend Node.js + Express + Sequelize + MySQL
│   ├── src/
│   │   ├── models/             # Modelos de base de datos
│   │   ├── routes/             # Enrutadores modulares por dominio (live, pools, plans, etc.)
│   │   ├── services/           # Lógica de cálculo (WfmService, attendanceSync)
│   │   └── index.js            # Entrypoint del servidor API
│   └── tests/                  # Pruebas automatizadas (Jest)
├── docs/                       # Documentación técnica y operativa
│   ├── ARCHITECTURE.md         # Diagrama de arquitectura y contratos de red
│   ├── CHANGELOG.md            # Histórico de cambios
│   └── MANUAL_OPERACION.md     # Manual de usuario para Workforce y Supervisores
├── specs/                      # Especificaciones funcionales (Single Source of Truth)
│   ├── capacity_wfm_spec.md    # Especificación completa y fórmulas matemáticas
│   ├── PRE-SPEC.md             # Borrador de requerimientos
│   └── SPEC_STATE.json         # Registro de estado y decisiones de arquitectura
├── INICIAR_WORKFORCE.bat       # Lanzador automático portátil
└── README.md                   # Esta guía
```

---

## 🚀 Inicio Rápido

### Opción 1: Lanzador Automático
Haz doble clic en `INICIAR_WORKFORCE.bat`. El script levantará automáticamente tanto el servidor Backend como la aplicación Frontend en terminales dedicadas.

### Opción 2: Inicio Manual

1. **Backend (Servidor API):**
   ```bash
   cd server
   npm install
   npm run dev
   ```
   *Disponible en `http://localhost:5000`*

2. **Frontend (Interfaz de Usuario):**
   ```bash
   cd client
   npm install
   npm run dev -- --host
   ```
   *Disponible en `http://localhost:5173`*

---

## 🧪 Pruebas Automatizadas

Para validar las reglas matemáticas del motor de suma cero:
```bash
cd server
npm test
```

---

## 📖 Documentación

- Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalles de arquitectura, integración de APIs y puertos.
- Consulta [specs/capacity_wfm_spec.md](specs/capacity_wfm_spec.md) para la especificación de fórmulas de capacidad y reglas de dotación.
- Consulta [docs/MANUAL_OPERACION.md](docs/MANUAL_OPERACION.md) para la guía operativa de usuario.
