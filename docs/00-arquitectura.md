# Arquitectura del sistema

## Qué es esto

Sistema de gestión integral para la Academia de Choferes Gimenoos (San Carlos,
Maldonado, Uruguay). Cubre el sitio público, la agenda de clases, los pagos, la
ficha del alumno y el expediente del trámite de libreta.

## Forma general

Un backend único con tres frontends que lo consumen:

```
                     ┌──────────────────────────┐
   Público  ───────▶ │ apps/landing  (React)    │ ──┐
                     └──────────────────────────┘   │
                     ┌──────────────────────────┐   │   HTTPS
   Academia ───────▶ │ apps/admin    (React)    │ ──┼──────────▶  apps/api  (NestJS)
                     └──────────────────────────┘   │                  │
                     ┌──────────────────────────┐   │                  │ Prisma v5
   Alumno   ───────▶ │ apps/cliente  (PWA)      │ ──┘                  ▼
                     └──────────────────────────┘              Supabase (Postgres)
                                │                                      ▲
                                └──────────────────────────────────────┘
                                   Auth (JWT) + Storage (archivos)
```

### Por qué tres frontends y no uno

- **La landing es pública y tiene que cargar rápido.** Si compartiera el bundle
  con el panel, cada visitante bajaría código de administración que nunca va a
  usar. Eso perjudica la conversión y el SEO local, que es el canal principal de
  captación de una academia de barrio.
- **El panel y la PWA tienen audiencias y ciclos de vida distintos.** El panel se
  usa en escritorio durante la jornada; la PWA se instala en el teléfono del
  alumno. Separarlos permite desplegar uno sin tocar el otro.
- **Reduce la superficie de ataque.** El bundle público no contiene ni siquiera
  las rutas del panel.

### Por qué un solo backend

La lógica de negocio (¿este horario está libre?, ¿este pago está aprobado?,
¿quién puede ver este documento?) tiene que vivir en un solo lugar. Duplicarla
entre frontends garantiza que tarde o temprano diverjan y aparezca un agujero.

## Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontends | React 19 + Vite 6 + Tailwind 4 | Build rápido, sin configuración pesada |
| PWA | vite-plugin-pwa (injectManifest) | Service worker propio, necesario para push en Etapa 3 |
| Backend | NestJS 11 | Estructura modular con inyección de dependencias; guards e interceptors resuelven auth y validación de forma transversal |
| ORM | Prisma v5 | Tipado de punta a punta y migraciones versionadas en SQL |
| Base | PostgreSQL (Supabase) | Las `EXCLUDE` constraints resuelven la doble reserva en la base |
| Auth | Supabase Auth | Gestión de sesiones, correos y rotación de claves sin escribirla nosotros |
| Archivos | Supabase Storage | Buckets privados con RLS para documentos y comprobantes |

## Estructura del repositorio

```
ats_academia_gimenoos/
├── apps/
│   ├── api/         Backend NestJS + Prisma (única fuente de lógica de negocio)
│   ├── landing/     Sitio público con SEO local
│   ├── admin/       Panel de la academia
│   └── cliente/     PWA del alumno
├── packages/
│   └── shared/      Enums y constantes compartidos (sin dependencias de framework)
├── docs/            Esta documentación
├── infra/
│   ├── postgres/    Inicialización del Postgres local
│   └── supabase/    Scripts SQL a ejecutar en Supabase (buckets y RLS)
└── docker-compose.yml
```

### Regla de dependencias

`packages/shared` no depende de nada del proyecto y no importa React ni NestJS.
Contiene solo tipos y constantes. Cualquier app puede importarlo; él no importa
a nadie. Así se evita el acoplamiento circular entre frontends y backend.

## Decisiones de diseño que conviene conocer antes de tocar código

1. **El vehículo es un recurso reservable, no un dato de la clase.** Una clase
   ocupa simultáneamente instructor y vehículo, y cada uno tiene su propio
   calendario. Ver `docs/01-modelo-datos.md`.
2. **La doble reserva se impide en la base de datos, no en el servicio.** Ver la
   sección de `EXCLUDE` constraints en `docs/01-modelo-datos.md`.
3. **Todas las fechas se guardan en UTC** (`timestamptz`) y se convierten a
   `America/Montevideo` recién al mostrarlas. Uruguay no aplica horario de verano
   desde 2015, pero atar la base a una zona horaria es una deuda que se paga cara.
4. **El monto de un pago siempre lo calcula el backend.** Nunca se toma del
   cuerpo del request.
5. **Los archivos sensibles nunca son públicos.** Se leen con signed URL de corta
   duración generada por el backend.
