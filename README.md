# Sistema de Gestión — Academia de Choferes Gimenoos

Sistema integral para la Academia de Choferes Gimenoos (San Carlos, Maldonado,
Uruguay): sitio público, agenda de clases, pagos, ficha del alumno y expediente
del trámite de libreta.

## Estado: Etapa 0 completada

Las fundaciones están listas y verificadas. Ver [`docs/04-plan-etapas.md`](docs/04-plan-etapas.md).

Cada pull request contra `main` corre verificaciones automáticas de tipos,
compilación, migraciones, las constraints de agenda y control de secretos.
Ver [`docs/08-ci-cd.md`](docs/08-ci-cd.md).

## Stack

React 19 + Vite 6 + Tailwind 4 · NestJS 11 + Prisma 5 · Supabase (Postgres, Auth, Storage)

## Estructura

```
apps/
  api/       Backend NestJS + Prisma — única fuente de lógica de negocio
  landing/   Sitio público con SEO local          (puerto 5173)
  admin/     Panel de la academia                 (puerto 5174)
  cliente/   PWA del alumno                       (puerto 5175)
packages/
  shared/    Enums y constantes compartidos
docs/        Documentación del proyecto
infra/       Postgres local y scripts SQL de Supabase
```

## Arranque rápido

```bash
pnpm install
pnpm db:up                                    # Postgres local
cd apps/api && cp .env.example .env
pnpm prisma:migrate && pnpm prisma:seed && cd ../..
pnpm api:dev                                  # http://localhost:3000/api/v1
```

Guía completa: [`docs/06-guia-desarrollo.md`](docs/06-guia-desarrollo.md).

## Documentación

| Documento | Para qué |
|---|---|
| [Arquitectura](docs/00-arquitectura.md) | Entender el sistema |
| [Modelo de datos](docs/01-modelo-datos.md) | Entidades y anti-doble-reserva |
| [Seguridad](docs/02-seguridad.md) | Auth, permisos y checklist obligatorio |
| [Supabase](docs/03-supabase.md) | Conectar el proyecto |
| [Plan de etapas](docs/04-plan-etapas.md) | Qué sigue |
| [Protección de datos](docs/05-proteccion-datos.md) | Cumplimiento |
| [Guía de desarrollo](docs/06-guia-desarrollo.md) | Cómo trabajar acá |
| [Roadmap](docs/07-roadmap.md) | **Acciones pendientes del lado de la academia** |
| [CI/CD](docs/08-ci-cd.md) | Verificaciones automáticas antes de mergear |
| [Despliegue](docs/09-despliegue.md) | Poner el sistema en línea: Render + Vercel |
| [Motor de agenda](docs/10-motor-agenda.md) | Cálculo de horarios, reservas y permisos |
| [Panel](docs/11-panel.md) | Pantallas del panel de administración |
| [PWA del alumno](docs/12-pwa-alumno.md) | La app del alumno y sus permisos |
| [El mapa](docs/20-mapa.md) | Ubicación en el sitio y cómo marcarla desde el panel |
| [App del instructor](docs/21-pwa-instructor.md) | Su agenda por día, semana o mes; cerrar y cancelar clases; por qué no entra al panel |
| [Avisos](docs/22-avisos.md) | Confirmaciones y errores: el motivo real, en español, en las tres aplicaciones |
| [Avisos por Telegram](docs/23-avisos-telegram.md) | Enterarse al instante de clases y consultas, sin entrar al panel |
| [Recordatorios](docs/24-recordatorios.md) | El aviso 24 h y 2 h antes de cada clase, y cómo se dispara |
| [Avisos en el teléfono](docs/25-avisos-en-el-telefono.md) | La notificación que recibe el alumno, sin costo ni servicios externos |
| [Cierre de la base](docs/26-cierre-de-la-base.md) | **Ninguna tabla se lee desde el navegador: cómo se cerró y cómo verificarlo** |
| [Auditoría de seguridad](docs/27-auditoria-de-seguridad.md) | **Revisión de punta a punta, con lo encontrado y lo que falta** |
| [Recordatorio por correo](docs/28-recordatorio-por-correo.md) | El tercer canal de aviso, y cómo se da de baja quien no lo quiere |
| [Pagos y tablero](docs/29-pagos.md) | Cómo paga un alumno, cómo se aprueba, y el resumen que abre el panel |
| [Buscadores, carruseles y navbar](docs/30-buscadores-carruseles-y-navbar.md) | El buscador de alumno, la galería de egresados por años y el menú del panel |
| [Arreglos de pago y avisos](docs/31-arreglos-pago-y-avisos.md) | Subir el comprobante desde el teléfono, y qué falta para los avisos |
| [Segunda auditoría](docs/32-auditoria-2.md) | **Revisión de todo lo nuevo: 103 comprobaciones, 3 hallazgos corregidos** |

## Antes de publicar

El sistema funciona con **datos de ejemplo**. Buscar `TODO(datos-reales)` en el
repositorio para el listado de lo que debe reemplazarse (contacto, precios,
instructores, vehículos, logo y dominio).
