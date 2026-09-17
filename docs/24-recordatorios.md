# Recordatorios de clase

El día antes y dos horas antes de cada clase, la academia recibe un aviso con el
alumno, el horario, el instructor y **el teléfono a mano**, por si hay que
llamarlo.

Esta es la primera de tres entregas. Acá está el motor completo y el aviso a la
academia; el aviso al alumno en su teléfono y el correo vienen después, y usan
este mismo motor.

---

## 1. La decisión que ordena todo lo demás

**Los recordatorios no los lanza un temporizador dentro de la API.**

En el plan gratuito de Render el servicio **se suspende por inactividad**. Un
temporizador suspendido no dispara nada, y lo haría sin un solo error en ningún
registro: los recordatorios simplemente dejarían de salir y nadie se enteraría
hasta que un alumno faltara a una clase. Para un recordatorio esa es la peor
forma posible de fallar.

La solución es una llamada desde afuera, que resuelve las dos cosas con un solo
mecanismo: **despierta** al servicio y **hace** el trabajo.

```
GitHub Actions  ──POST /recordatorios/procesar──▶  API  ──▶  Telegram
   cada 15 min        x-recordatorios-token
```

Hoy lo llama un workflow de GitHub Actions, porque ya está en el repositorio, es
gratis y no suma ninguna cuenta nueva. Sirve igual cualquier otra cosa que sepa
hacer un POST.

---

## 2. Cómo ponerlo a andar

### Paso 1 — Generar el secreto

```
openssl rand -base64 48
```

### Paso 2 — Cargarlo en los dos lados

| Dónde | Qué |
|---|---|
| **Render** → Environment | `RECORDATORIOS_TOKEN` = el secreto |
| **GitHub** → Settings → Secrets and variables → Actions → *Secrets* | `RECORDATORIOS_TOKEN` = **el mismo** secreto |
| **GitHub** → la misma pantalla → *Variables* | `API_URL` = `https://gimenoos-api.onrender.com/api/v1` |

### Paso 3 — Probarlo

En GitHub → pestaña **Actions** → «Recordatorios de clase» → **Run workflow**.
La corrida muestra la respuesta de la API:

```
HTTP 201
{"revisadas":3,"enviados":1,"repetidos":2,"omitidos":0,"fallidos":0}
```

> Los recordatorios usan el bot de Telegram, así que primero tiene que estar
> configurado eso. Ver [`23-avisos-telegram.md`](23-avisos-telegram.md).

---

## 3. Cuándo sale un recordatorio

Tres condiciones, y la tercera es la que no es obvia.

1. **La ventana está abierta.** A 25 horas de la clase, el de 24 todavía no toca.
2. **La clase no empezó.** Si el disparador estuvo caído medio día, al volver no
   manda recordatorios de clases que ya pasaron.
3. **La reserva existía cuando la ventana se abrió.** Sin esto, alguien que
   reserva para dentro de tres horas recibiría el recordatorio de 24 horas en el
   acto —la ventana ya estaba abierta cuando reservó—, o sea un aviso sobre algo
   que acaba de hacer.

Consecuencia de la tercera: **quien reserva con menos antelación que el
recordatorio no recibe ese recordatorio**, y está bien. Quien reserva con tres
horas de antelación no recibe el de 24 horas, pero sí el de 2.

Tampoco se recuerda una clase **cancelada, dictada o con ausencia**.

---

## 4. Por qué nunca llegan dos veces

La garantía es **una clave única de la base**, no una comprobación en el código:

```
@@unique([reservaId, tipo, canal])
```

El disparador es externo y puede llamar dos veces: un reintento de `curl`, dos
ejecuciones que se pisan, alguien que aprieta «Run workflow» mientras corre la
programada. Con una comprobación en el código, dos pasadas simultáneas leerían
«todavía no se mandó» al mismo tiempo y mandarían las dos.

Por eso el orden es: **primero se reserva el lugar en la base, después se
manda**. La segunda pasada choca contra la clave única y se detiene sin haber
mandado nada. Hay una prueba que corre dos pasadas **en paralelo** y comprueba
que salga un solo aviso.

### El caso que parece un detalle y no lo es

Un recordatorio que **no correspondía mandar** —todavía no hay bot, o el
interruptor está apagado— **no queda anotado**. Si quedara, configurar el bot hoy
dejaría sin recordatorio a las clases de mañana: ya estarían marcadas como
avisadas sin que nadie hubiera recibido nada.

En cambio, uno que se **intentó y falló** sí queda anotado, con el motivo, y no
se reintenta. Reintentarlo cada quince minutos hasta que la clase empiece sería
peor que perderlo.

---

## 5. Seguridad

**El endpoint no usa la sesión de Supabase.** Quien llama es una máquina, no una
persona. Usa un secreto compartido en el encabezado `x-recordatorios-token`.

**Sin el secreto configurado, contesta 503.** No queda abierto: una puerta sin
llave es peor que una puerta cerrada.

**La comparación es en tiempo constante** (`timingSafeEqual`). Con `===`, el
tiempo que tarda en devolver falso depende de cuántos caracteres coincidieron
desde el principio, y eso alcanza para adivinar el secreto de a un carácter por
vez.

**Una sesión de administrador no sirve para llamarlo.** Comprobado sobre HTTP
real: con un token de admin válido y sin el secreto, contesta 401.

**El aviso lleva el teléfono del alumno.** Es el único que lo lleva, y es
deliberado: este mensaje existe para poder **llamarlo**, y sin el número hay que
ir a buscarlo al panel, que es justo el trabajo que el aviso viene a ahorrar. No
lleva cédula, ni correo, ni dirección.

---

## 6. Los dos riesgos de GitHub Actions, aceptados a conciencia

**GitHub no garantiza la puntualidad de `schedule`.** Una corrida puede
demorarse, y con mucha carga en la plataforma puede saltearse. Para un
recordatorio de 2 horas una demora de 15 minutos no cambia nada, y si una corrida
se saltea, la siguiente manda igual lo que quedó pendiente: la ventana no se
cierra hasta que la clase empieza.

**GitHub desactiva los workflows programados tras 60 días sin actividad en el
repositorio**, avisando por correo. Si la academia queda dos meses sin cambios,
hay que reactivarlo desde la pestaña Actions.

Si alguno de los dos llega a molestar, las alternativas son:

| Alternativa | Qué cambia |
|---|---|
| **cron-job.org** o **UptimeRobot** (gratis) | Más puntual, no se desactiva solo. Suma una cuenta externa |
| **Cron Job de Render** | Todo en un solo proveedor. **No verificado**: hay que confirmar si está disponible en el plan que use la academia |
| **Temporizador interno** (`@nestjs/schedule`) | Sirve **solo** con un plan de Render que no suspenda el servicio |

Nada de esto cambia el código de la API: el endpoint es el mismo.

---

## 7. Qué se verificó

| | |
|---|---|
| Las reglas de cuándo sale cada recordatorio | ✅ 18 pruebas, incluidos los bordes de cada ventana |
| Que no salga dos veces, con la base real | ✅ 9 pruebas, una con dos pasadas **en paralelo** |
| La autenticación del endpoint, sobre HTTP real | ✅ sin token, token equivocado del mismo largo, token corto, y sesión de admin: 401 las cuatro |
| El ciclo completo sobre HTTP real | ✅ sin bot → no anota; con bot → intenta, falla y anota el motivo; segunda pasada → no reintenta |

**No verificado:** la entrega real a Telegram. El entorno de desarrollo no
alcanza `api.telegram.org`, igual que no alcanza `supabase.co`. Lo que sí está
comprobado es todo el camino hasta la llamada, y que el fallo se registra con su
motivo.

---

## 8. Dónde tocar

| Para… | Archivo |
|---|---|
| Cambiar la antelación, o agregar un recordatorio más | `ANTELACION_HORAS` en `modules/recordatorios/reglas.ts` y el enum `TipoRecordatorio` |
| Cambiar el texto del aviso | `modules/recordatorios/mensajes.ts` |
| Cambiar cada cuánto se dispara | El `cron` de `.github/workflows/recordatorios.yml` |
| Apagarlo sin tocar código | Panel → Avisos → «Recordatorio de clase» |
