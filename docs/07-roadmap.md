# Roadmap: qué tenés que hacer

Este documento lista **tus acciones**, no las de desarrollo. Está ordenado por
dependencia: cada bloque desbloquea el siguiente.

Lo que corresponde al código está en [`04-plan-etapas.md`](04-plan-etapas.md).

---

## Bloque 1 — Seguridad inmediata 🔴

**Hacer ahora, antes que nada.**

- [ ] **Rotar la contraseña de la base**
      Supabase → Project Settings → Database → *Reset database password*.
      Actualizar las dos cadenas en `apps/api/.env`.
- [ ] **Rotar la clave `service_role`**
      Supabase → Project Settings → API → *Rotate*.
      Actualizar `SUPABASE_SERVICE_ROLE_KEY` en `apps/api/.env`.

Ambos secretos quedaron expuestos en una conversación de chat. La `anon` no hace
falta rotarla: está pensada para ser pública.

> De acá en adelante, los secretos se pasan por un gestor de contraseñas o se
> cargan directo en el `.env`, nunca por chat, correo o mensajería.

---

## Bloque 2 — Dejar Supabase funcionando 🟠

Sin esto no se puede probar nada de punta a punta.

- [ ] **1º. Aplicar el esquema a la base**
      ```bash
      cd apps/api && pnpm supabase:setup
      ```
      Encadena migraciones, datos iniciales y verificación. El verificador te
      dice si las tres constraints anti-doble-reserva quedaron activas.

      Para confirmar que salió bien: el **Table Editor** de Supabase tiene que
      mostrar las tablas (`usuarios`, `clientes`, `reservas`, …). Si sigue
      vacío, las migraciones no se aplicaron.
- [ ] **2º. Crear los buckets de archivos**
      Ejecutar `infra/supabase/01-storage.sql` en el SQL Editor de Supabase.
      Confirmar en Storage que ambos figuren como *Private*.

      **Va después del paso anterior**: las políticas consultan la tabla
      `usuarios`. Si se ejecuta antes, el script se detiene y te lo dice.
- [ ] **Configurar Auth**
      Authentication → URL Configuration: cargar las *Redirect URLs* del panel y
      de la PWA. Supabase solo redirige a URLs de esa lista.
- [ ] **Traducir las plantillas de correo al español**
      Authentication → Email Templates. Esos correos los recibe el alumno.
- [ ] **Crear el primer administrador**
      Paso 7 de [`03-supabase.md`](03-supabase.md).
- [ ] **Volver a correr `pnpm verificar`** y que dé todo en verde.

---

## Bloque 3 — Activar las verificaciones automáticas 🟡

El CI ya está en el repositorio, pero **por defecto no bloquea nada**: informa.
Para que impida mergear código roto:

- [ ] **Proteger la rama `main`**
      Settings → Branches → *Add branch protection rule* sobre `main`, con:
      - *Require a pull request before merging*
      - *Require status checks to pass before merging*, marcando los tres:
        `Tipos y compilacion`, `Migraciones y constraints de agenda`,
        `Control de secretos`
      - *Require branches to be up to date before merging*

Detalle en [`08-ci-cd.md`](08-ci-cd.md).

---

## Bloque 4 — Datos reales de la academia 🟢

El sistema funciona con placeholders. Necesito que me pases:

- [ ] **Contacto**: dirección exacta del local, teléfono, WhatsApp (con código de
      país), correo, horarios de atención.
- [ ] **Precios** de cada servicio, en pesos uruguayos, diferenciando **contado o
      transferencia** de **tarjeta**. Para: clase suelta de auto, packs de auto,
      clase suelta de moto, packs de moto, gestoría del trámite.
- [ ] **Instructores**: nombre, qué dicta (moto, auto o ambos), y si querés que
      aparezcan en el sitio, foto y una línea de presentación.
- [ ] **Vehículos**: patente, tipo, marca, modelo, cilindrada (en motos) y
      vencimiento del SOA.
- [ ] **Duración real de las clases** y cuántos minutos de margen dejás entre una
      y otra.
- [ ] **Política de cancelación**: con cuánta antelación puede cancelar un alumno
      sin penalidad.
- [ ] **Marca**: logo y colores. Con eso se ajustan la landing y los íconos de la PWA.
- [ ] **Dominio** definitivo del sitio.

Mientras falten, las secciones sin datos reales simplemente no se muestran: el
sitio nunca publica información inventada.

---

## Bloque 5 — Textos legales ⚪

Necesarios antes de abrir el sitio al público. Conviene revisarlos con un asesor.

- [ ] Política de privacidad
- [ ] Términos y condiciones
- [ ] Política de cancelación de clases
- [ ] Texto de consentimiento del formulario de alta
- [ ] Autorización escrita de cada alumno cuyo testimonio se publique

- [ ] **Inscribir las bases de datos ante la URCDP**
      Trámite administrativo de la academia. El sistema trata datos personales,
      incluidos datos de salud (el certificado médico del trámite).
- [ ] **Redactar el procedimiento ante una vulneración de datos**
      Ver [`05-proteccion-datos.md`](05-proteccion-datos.md).

---

## Bloque 6 — Decisiones que tengo que consultarte ❓

Ninguna es urgente, pero cada una cambia lo que se construye.

| Decisión | Por qué importa | Cuándo |
|---|---|---|
| **Dónde se despliega** (API, sitio, panel, PWA) | Determina el CD. La API necesita un contenedor con salida a internet; los frontends son estáticos | Antes de salir a producción |
| **API de Mercado Pago Point en Uruguay** | Hay que confirmar **con Mercado Pago** si está habilitada en producción para cuentas en pesos. Si no, el cobro presencial queda como registro manual | Antes de la Etapa 2 |
| **Canal de recordatorios** | WhatsApp tiene más llegada pero requiere Business API y tiene costo por conversación. Correo y push de la PWA son gratis | Etapa 3 |
| **Requisitos vigentes del trámite** | Los define la Intendencia de Maldonado, cambian y varían por departamento. Hay que confirmarlos en la fuente oficial | Antes de la Etapa 3 |
| **Clases teóricas grupales** | Necesitan un modelo de datos distinto al de las clases individuales | Si entran en alcance |

---

## Orden sugerido

```
Bloque 1 (seguridad)  →  Bloque 2 (Supabase)  →  Bloque 3 (CI)
                                  ↓
                         Etapa 1: agenda  ←  Bloque 4 (datos reales)
                                  ↓
                         Etapa 2: pagos   ←  confirmación de Mercado Pago
                                  ↓
                    Etapa 3: expedientes  ←  Bloque 5 (legales)
```

Los bloques 1 a 3 son tuyos y llevan poco tiempo. El 4 se puede ir completando
en paralelo mientras avanza la Etapa 1.
