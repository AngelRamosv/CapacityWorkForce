# Arquitectura del Sistema: Capacity WFM (Spec-Driven Development)

Capacity WFM es una plataforma operativa Full-Stack diseñada bajo la metodología **Spec-Driven Development (SDD)**. Toda la lógica del sistema se desprende y valida contra las especificaciones formales ubicadas en la carpeta `specs/`.

---

## 1. Estructura del Proyecto

```text
WorkForce/
├── client/                     # Frontend SPA (React + TypeScript + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/                # Cliente HTTP Axios (conexión al backend)
│   │   ├── components/         # Componentes reutilizables (Layout, Confetti, etc.)
│   │   └── pages/              # Vistas de la aplicación (Live, Plan, Setup, Vacaciones, etc.)
├── server/                     # Backend API (Node.js + Express + Sequelize + MySQL)
│   ├── src/
│   │   ├── models/             # Modelos Sequelize (Campana, Configuracion, PlanSemanal, etc.)
│   │   ├── routes/             # Enrutadores modulares (pools, config, staff, live, plans, reports)
│   │   ├── services/           # Lógica pura de negocio (WfmService, attendanceSync)
│   │   ├── data/               # Almacenamiento dinámico en tiempo de ejecución
│   │   ├── database.js         # Configuración y conexión a MySQL
│   │   └── index.js            # Punto de entrada principal del servidor Express
│   └── tests/                  # Pruebas automatizadas (Jest)
├── docs/                       # Documentación operativa y técnica
│   ├── ARCHITECTURE.md         # Este documento
│   ├── CHANGELOG.md            # Histórico de cambios y versiones
│   └── MANUAL_OPERACION.md     # Manual de usuario para Workforce y supervisores
├── specs/                      # Especificaciones del sistema (Single Source of Truth)
│   ├── capacity_wfm_spec.md    # Especificación funcional y fórmulas matemáticas
│   ├── PRE-SPEC.md             # Borrador inicial de requerimientos
│   └── SPEC_STATE.json         # Estado actual del proyecto y decisiones de diseño
├── INICIAR_WORKFORCE.bat       # Script de lanzamiento automático portátil
└── README.md                   # Resumen del proyecto y guía de inicio rápido
```

---

## 2. Componentes y Flujos de Datos

### Frontend (`client/`)
- Desarrollado con **React 19**, **Vite** y **Tailwind CSS** (Tema oscuro profesional).
- Se comunica con el backend a través de `http://localhost:5000/api`.
- Principales pantallas:
  - **Live Dashboard (`LiveDashboard.tsx`):** KPIs en tiempo real, agentes online, tasa de abandono y cobertura.
  - **Simulador (`Simulator.tsx`):** Distribución de agentes con validación estricta de suma cero.
  - **Planes (`Plan.tsx`):** Consulta histórica y versiones de planes de dotación.
  - **Reportes (`Reports.tsx`, `AttendanceReport.tsx`):** Descarga de asistencias e incidencias en Excel.
  - **Setup (`Setup.tsx`):** Ajustes de parámetros operativos (AHT, shrinkage, ocupación, metas).

### Backend Modular (`server/`)
- Servidor REST en **Express 5** escuchando en el puerto `5000`.
- Modularizado por dominio de negocio:
  - `routes/pools.routes.js`: Campañas activas (Retención, Móvil).
  - `routes/config.routes.js`: Parámetros globales y metas.
  - `routes/staff.routes.js`: Ingesta y normalización de nóminas desde archivos Excel.
  - `routes/live.routes.js`: Consumo y contingencia de la central telefónica Asterisk (`192.168.48.183:8050`).
  - `routes/plans.routes.js`: Creación y consulta de planes de capacidad.
  - `routes/reports.routes.js`: Exportación y consulta de retardos y ausencias.
  - `services/WfmService.js`: Motor matemático de cálculo de capacidad y balance de suma cero.
  - `services/attendanceSync.js`: Sincronización automática de asistencias contra la base de datos externa.

---

## 3. Integraciones Externas

| Sistema / Servicio | IP / URL | Puerto | Protocolo | Uso |
|---|---|---|---|---|
| **Marcador Central (PBX)** | `192.168.48.183` | `8050` | HTTP / JSON | Ingesta de llamadas y agentes en tiempo real (`/data`) |
| **Base de Datos Externa** | `192.168.50.33` | `3306` | MySQL | Consulta histórica de `reporteProductividad` |
| **Base de Datos Local** | `localhost` | `3306` | MySQL | Persistencia de configuraciones, planes y agentes |
