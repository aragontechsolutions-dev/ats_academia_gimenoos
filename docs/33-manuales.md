# Los manuales de uso

> Tres manuales, uno por rol. El alumno y el instructor ven el suyo dentro de su
> app; **la administración ve los tres**, para poder acompañar por teléfono a
> alguien mirando exactamente lo mismo que esa persona tiene en la pantalla.

---

## 1. Qué va en cada uno

| Manual | Contenido | Por qué |
|---|---|---|
| **Alumno** | Solo **lo que puede hacer** | No necesita saber cómo funciona el sistema por dentro; necesita saber dónde tocar |
| **Instructor** | Solo **lo que puede hacer** | Ídem |
| **Administración** | Las acciones **y los flujos completos**, incluidos los de los otros dos roles | Es quien contesta cuando algo no se entiende |

El manual de administración tiene quince secciones. Cuatro son **flujos**: el
ciclo de una clase, el ciclo de un pago por transferencia, cómo entra alguien
nuevo al sistema y quién recibe qué aviso. Cada paso dice **quién lo hace**
—el alumno, la academia, el instructor o el sistema—, porque lo importante de un
flujo no es solo el orden: es de quién depende que avance.

---

## 2. Dónde se ve cada uno

| Rol | Dónde |
|---|---|
| Alumno | Signo de pregunta arriba a la derecha → `/manual` |
| Instructor | Ídem → `/manual` |
| Administración | Menú **Manuales** (último ícono) → `/manuales`, con un selector de los tres |

**Por qué el signo de pregunta y no la barra de abajo.** La app del alumno tiene
cuatro secciones ahí y una quinta la deja apretada en un teléfono chico. La del
instructor no tiene barra: es una sola pantalla. El signo de pregunta arriba a
la derecha es donde se lo busca en las dos.

---

## 3. Una sola fuente

El texto vive en `packages/shared/src/manuales.ts` y lo leen las tres
aplicaciones.

No es un detalle de organización: **el panel muestra el manual del alumno**.
Con el texto repartido en tres proyectos, el que lee el alumno y el que lee
quien lo está ayudando se irían separando sin que nadie lo notara, y el día que
pasara sería justo cuando más importa.

Hay una prueba de navegador que lo comprueba: abre el manual del alumno desde el
panel y verifica que contiene la misma frase que ve el alumno en su app.

### Es dato, no marcado

El manual es una estructura de datos (`secciones`, `acciones`, `flujo`,
`aviso`), y cada app la dibuja con su propio aspecto. En este proyecto **no hay
un solo `dangerouslySetInnerHTML`** y un manual no es motivo para estrenarlo.

### Y es TypeScript pelado, no `.tsx`

`packages/shared` lo consumen Vite, `tsc`, `ts-node` y Jest, y la API lo importa
desde Node. Un componente de React ahí adentro obligaría a cambiar ese contrato
para todos. Los tres dibujantes son cortos y cada uno usa el aspecto de su app,
así que tampoco habría mucho que compartir.

---

## 4. Cada app lleva solo su manual

Los tres están en un mismo objeto (`MANUALES`), y sin embargo el bundle del
alumno **no contiene** el de administración. Lo poda el empaquetador, porque
cada app accede a una propiedad fija (`MANUALES.CLIENTE`) y Rollup sabe
descartar el resto.

Eso está bien, pero depende del analizador. **Si alguien escribiera
`MANUALES[algoDinamico]` en una PWA, los tres viajarían al navegador de cada
alumno**, incluido el de administración, que describe los flujos internos.

Hay un paso de CI que lo comprueba sobre los bundles compilados:

```
revisar cliente    'Manual del alumno'       1
revisar cliente    'puede hacer que'         0   ← frase exclusiva del de administración
revisar cliente    'Manual del instructor'   0
revisar instructor 'Manual del instructor'   1
revisar instructor 'Manual del alumno'       0
revisar admin      'Manual de administraci'  1
```

---

## 5. Lo que se comprobó

**25 comprobaciones en el navegador**, en las tres aplicaciones:

- El alumno llega a su manual desde el encabezado, y la barra de abajo **sigue
  con cuatro secciones**.
- Su manual trae las seis secciones, tiene índice para saltar, y **no le explica
  flujos internos** (se verifica que no aparezca la palabra «Flujo:»).
- No se desborda a lo ancho en 390 px.
- El instructor igual, y «Salir» sigue en su lugar.
- El panel ofrece los tres, abre en el de administración, trae los cuatro flujos
  con sus pasos numerados, y al cambiar al del alumno muestra **la misma frase
  exacta** que el alumno ve en su app.

**Seguridad** (barrido completo, 107 comprobaciones, todas pasan):

- Los manuales **no agregaron ninguna ruta a la API**: `/manuales`, `/manual` y
  `/ayuda` devuelven 404, con y sin sesión. Hay además una prueba en el
  inventario de rutas que falla si algún día aparece un controlador con ese
  nombre.
- El texto **no viaja en el HTML servido**: lo dibuja React después de
  comprobar la sesión. Se verificó pidiendo las tres direcciones sin sesión.
- No se introdujo `dangerouslySetInnerHTML` en ninguna parte.
- El contenido no nombra credenciales, rutas internas ni nada que ayude a
  atacar el sistema.
- `pnpm audit` sigue en cero y ningún bundle contiene secretos.
- Las 507 pruebas automáticas siguen pasando.

---

## 6. Cómo cambiar un manual

Se edita `packages/shared/src/manuales.ts` y listo: las tres aplicaciones lo
toman de ahí. No hay que tocar ninguna pantalla salvo que se quiera cambiar
**cómo** se ve, que es otra cosa y vive en cada app:

```
apps/cliente/src/paginas/ManualDeUso.tsx
apps/instructor/src/paginas/ManualDeUso.tsx
apps/admin/src/paginas/Manuales.tsx
```

Si se agrega una sección al manual de administración con un flujo nuevo, conviene
revisar que el paso de CI siga teniendo una frase exclusiva de ese manual para
detectar una poda rota.
