# Roadmap: qué tenés que hacer

Este documento lista **tus acciones**, no las de desarrollo. Está ordenado por
dependencia: cada bloque desbloquea el siguiente.

Lo que corresponde al código está en [`04-plan-etapas.md`](04-plan-etapas.md).

---

## Bloque 1 — Seguridad inmediata 🔴

Los secretos que se expusieron en una conversación de chat pertenecían al
proyecto Supabase de São Paulo. Al crear el proyecto nuevo en East US quedaron
reemplazados, **pero siguen siendo válidos mientras el proyecto viejo exista**.

- [ ] **Borrar el proyecto Supabase anterior**
      Project Settings → General → *Delete project*. Esto anula de raíz la
      contraseña y la clave `service_role` que se filtraron; es más seguro que
      rotarlas.

- [ ] **No pegar las credenciales nuevas en ningún chat.**
      Van del panel de Supabase directamente a los campos de Render y Vercel.
      Cada credencial que pasa por un mensaje hay que rotarla después.

---

## Bloque 2 — Desplegar y dejar Supabase funcionando 🟠

Sin esto no se puede probar nada de punta a punta.

**No hace falta clonar el repositorio.** Render aplica las migraciones durante
el deploy, así que desplegar la API es lo que crea las tablas en Supabase.

- [ ] **1º. Desplegar la API en Render** → Fase 1 de [`09-despliegue.md`](09-despliegue.md).
      Al terminar, el **Table Editor** de Supabase tiene que mostrar las tablas
      (`usuarios`, `clientes`, `reservas`, …). Si sigue vacío, las migraciones
      no corrieron: revisar los logs del deploy.
- [ ] **2º. Crear los buckets de archivos**
      Ejecutar `infra/supabase/01-storage.sql` en el SQL Editor de Supabase.
      Confirmar en Storage que ambos figuren como *Private*.

      **Va después del paso anterior**: las políticas consultan la tabla
      `usuarios`. Si se ejecuta antes, el script se detiene y te lo dice.
- [ ] **3º. Desplegar los tres frontends en Vercel** → Fase 3.
- [ ] **4º. Conectar las piezas**: `CORS_ORIGINS` en Render con las URLs de
      Vercel, y esas mismas URLs en las *Redirect URLs* de Supabase Auth → Fase 4.
- [ ] **5º. Traducir las plantillas de correo al español**
      Authentication → Email Templates. Esos correos los recibe el alumno.
- [ ] **6º. Crear el primer administrador** → Fase 4.3.
- [ ] **7º. Verificación de punta a punta** → Fase 5.

> Si preferís trabajar en local (opcional, no es requisito): cloná el
> repositorio y corré `cd apps/api && pnpm supabase:setup`, que hace lo mismo
> que el deploy de Render y además ejecuta el verificador.

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
| ~~Dónde se despliega~~ | **Resuelto**: Render (API) + Vercel (frontends). Ver [`09-despliegue.md`](09-despliegue.md) | ✅ |
| ~~Región de la base~~ | **Resuelto**: proyecto recreado en East US (`us-east-1`). El servicio de Render va en Virginia, junto a la base | ✅ |
| **API de Mercado Pago Point en Uruguay** | Hay que confirmar **con Mercado Pago** si está habilitada en producción para cuentas en pesos. Si no, el cobro presencial queda como registro manual | Antes de la Etapa 2 |
| **Canal de recordatorios** | WhatsApp tiene más llegada pero requiere Business API y tiene costo por conversación. Correo y push de la PWA son gratis | Etapa 3 |
| **Requisitos vigentes del trámite** | Los define la Intendencia de Maldonado, cambian y varían por departamento. Hay que confirmarlos en la fuente oficial | Antes de la Etapa 3 |
| **Clases teóricas grupales** | Necesitan un modelo de datos distinto al de las clases individuales | Si entran en alcance |

---

## Orden sugerido

```
Bloque 1 (seguridad)  →  Bloque 2 (desplegar)  →  Bloque 3 (CI)
                                  ↓
                         Etapa 1: agenda  ←  Bloque 4 (datos reales)
                                  ↓
                         Etapa 2: pagos   ←  confirmación de Mercado Pago
                                  ↓
                    Etapa 3: expedientes  ←  Bloque 5 (legales)
```

Los bloques 1 a 3 son tuyos y llevan poco tiempo. El 4 se puede ir completando
en paralelo mientras avanza la Etapa 1.
