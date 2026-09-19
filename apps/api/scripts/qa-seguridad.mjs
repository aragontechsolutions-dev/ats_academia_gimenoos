/**
 * Barrido de seguridad contra la API en marcha.
 *
 * Es lo que las pruebas de Jest NO pueden comprobar, porque hace falta el
 * servidor de verdad: las cabeceras HTTP, el CORS, el limite de peticiones, la
 * validacion de tokens firmados con otra clave, y sobre todo los intentos de
 * ACCESO CRUZADO —que Ana no pueda ver ni tocar lo de Bruno— pasando por el
 * guard, el controlador y el servicio como lo haria un atacante.
 *
 * COMO SE CORRE
 *
 *   1. Levantar la base y la API:      pnpm --filter @gimenoos/api start:dev
 *   2. Cargar los datos de prueba:     psql ... -f scripts/qa-seguridad.sql
 *   3. Generar los cuatro tokens:      ver el encabezado de ese .sql
 *   4. node scripts/qa-seguridad.mjs
 *
 * Se corre a mano y no en CI porque necesita una base con datos y cuatro
 * sesiones firmadas. Conviene pasarlo antes de cada despliegue grande y cada
 * vez que se toca un permiso.
 *
 * Los tokens se leen de archivos `t-qa-*.txt` en el directorio desde el que se
 * ejecuta. NUNCA se guardan en el repositorio.
 */

import { readFileSync } from 'node:fs';
import { SignJWT } from 'jose';

const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const T = Object.fromEntries(['admin', 'ana', 'bruno', 'inst'].map((r) => [r, readFileSync(`t-qa-${r}.txt`, 'utf8').trim()]));
const ID = {
  claseAna: '00000000-0000-4000-aa00-000000000031',
  claseBruno: '00000000-0000-4000-aa00-000000000032',
  fichaAna: '00000000-0000-4000-aa00-00000000000a',
  fichaBruno: '00000000-0000-4000-aa00-00000000000b',
  instructor: '00000000-0000-4000-aa00-0000000000e1',
  vehiculo: '00000000-0000-4000-aa00-0000000000f1',
  usuarioAna: '00000000-0000-4000-aa00-000000000002',
};

/** El secreto JWT del entorno local, para fabricar tokens invalidos a proposito. */
const SECRETO_LOCAL = process.env.SUPABASE_JWT_LEGACY_SECRET ?? 'secreto-solo-para-pruebas-locales-1234567890';
/** El emisor que la API espera. Sale del proyecto de Supabase. */
const EMISOR = process.env.EMISOR_JWT ?? 'https://ovudsdehtxqtecwyjuip.supabase.co/auth/v1';

let ok = 0; const fallos = [];
const check = (n, c, d = '') => { if (c) { ok++; console.log('  ✓', n); } else { fallos.push(`${n}${d ? ` — ${d}` : ''}`); console.log('  ✗', n, d); } };

async function pedir(ruta, { rol, metodo = 'GET', cuerpo, cabeceras = {}, token } = {}) {
  const t = token !== undefined ? token : rol ? T[rol] : undefined;
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...cabeceras,
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* sin cuerpo */ }
  return { estado: r.status, json, texto, cabeceras: r.headers };
}

// ============ 1. Acceso a datos de otra persona (IDOR) ============
console.log('\n═══ 1. ¿Puede alguien ver o tocar lo de otro? ═══');
{
  const r = await pedir(`/agenda/reservas/${ID.claseBruno}`, { rol: 'ana' });
  check('Ana NO puede ver la clase de Bruno', r.estado === 403 || r.estado === 404, `${r.estado} ${r.texto.slice(0,90)}`);
}
{
  const r = await pedir(`/agenda/reservas/${ID.claseBruno}/cancelar`, { rol: 'ana', metodo: 'PATCH', cuerpo: {} });
  check('Ana NO puede cancelar la clase de Bruno', r.estado === 403 || r.estado === 404, `${r.estado} ${r.texto.slice(0,90)}`);
}
{
  const r = await pedir(`/clientes/${ID.fichaBruno}`, { rol: 'ana' });
  check('Ana NO puede leer la ficha de Bruno', r.estado === 403, String(r.estado));
}
{
  const r = await pedir('/clientes', { rol: 'ana' });
  check('Ana NO puede listar alumnos', r.estado === 403, String(r.estado));
}
{
  const r = await pedir('/usuarios', { rol: 'inst' });
  check('El instructor NO puede listar cuentas', r.estado === 403, String(r.estado));
}
{
  const r = await pedir(`/clientes/${ID.fichaAna}`, { rol: 'inst' });
  check('El instructor NO puede leer la ficha de un alumno', r.estado === 403, String(r.estado));
}

// ============ 2. Escalada de privilegios ============
console.log('\n═══ 2. ¿Puede alguien subirse de rol? ═══');
{
  const r = await pedir('/usuarios/me', { rol: 'ana', metodo: 'PATCH', cuerpo: { nombre: 'Ana', apellido: 'Alumna', rol: 'ADMIN' } });
  check('Mandar "rol" en el perfil propio se RECHAZA', r.estado === 400, `${r.estado} ${r.texto.slice(0,110)}`);
  const luego = await pedir('/usuarios/me', { rol: 'ana' });
  check('y el rol sigue siendo CLIENTE', luego.json?.rol === 'CLIENTE', String(luego.json?.rol));
}
{
  const r = await pedir(`/usuarios/${ID.usuarioAna}`, { rol: 'ana', metodo: 'PATCH', cuerpo: { rol: 'ADMIN' } });
  check('Ana NO puede usar el endpoint de administración sobre sí misma', r.estado === 403, String(r.estado));
}
{
  const r = await pedir('/clientes/me', { rol: 'ana', metodo: 'PATCH', cuerpo: { nombre: 'Ana', apellido: 'Alumna', activo: false, usuarioId: '00000000-0000-4000-aa00-000000000001' } });
  check('Campos de más en la ficha propia se RECHAZAN', r.estado === 400, `${r.estado} ${r.texto.slice(0,110)}`);
}

// ============ 3. Reservar para otro ============
console.log('\n═══ 3. ¿Puede un alumno agendar en nombre de otro? ═══');
{
  const inicio = new Date(Date.now() + 9 * 24 * 3600 * 1000).toISOString();
  const r = await pedir('/agenda/reservas', { rol: 'ana', metodo: 'POST', cuerpo: {
    clienteId: ID.fichaBruno, instructorId: ID.instructor, vehiculoId: ID.vehiculo,
    tipo: 'AUTO', inicio, duracionMin: 45,
  }});
  if (r.estado === 201 || r.estado === 200) {
    const deQuien = r.json?.cliente?.id;
    check('El clienteId que manda Ana se IGNORA: la clase queda a su nombre', deQuien === ID.fichaAna, `quedó para ${deQuien}`);
  } else {
    check('El intento no prospera', true, `${r.estado} ${r.texto.slice(0,80)}`);
  }
}

// ============ 4. Tokens ============
console.log('\n═══ 4. Sesiones falsas o rotas ═══');
{
  const r = await pedir('/usuarios/me', { token: undefined });
  check('Sin token: 401', r.estado === 401, String(r.estado));
}
{
  const r = await pedir('/usuarios/me', { token: 'no-es-un-token' });
  check('Token con basura: 401', r.estado === 401, String(r.estado));
}
{
  // Firmado con OTRA clave: la firma no valida.
  const otro = await new SignJWT({ email: 'atacante@local', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('00000000-0000-4000-aa00-000000000001')
    .setIssuer(EMISOR).setAudience('authenticated')
    .setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode('clave-equivocada-de-un-atacante-0000000000'));
  const r = await pedir('/usuarios/me', { token: otro });
  check('Token firmado con otra clave: 401', r.estado === 401, `${r.estado} ${r.texto.slice(0,80)}`);
}
{
  const vencido = await new SignJWT({ email: 'qa-admin@local', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('00000000-0000-4000-aa00-000000000001')
    .setIssuer(EMISOR).setAudience('authenticated')
    .setIssuedAt(Math.floor(Date.now()/1000) - 7200).setExpirationTime(Math.floor(Date.now()/1000) - 3600)
    .sign(new TextEncoder().encode(SECRETO_LOCAL));
  const r = await pedir('/usuarios/me', { token: vencido });
  check('Token vencido: 401', r.estado === 401, String(r.estado));
}
{
  const malEmisor = await new SignJWT({ email: 'qa-admin@local', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('00000000-0000-4000-aa00-000000000001')
    .setIssuer('https://otro-proyecto.supabase.co/auth/v1').setAudience('authenticated')
    .setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRETO_LOCAL));
  const r = await pedir('/usuarios/me', { token: malEmisor });
  check('Token de OTRO proyecto de Supabase: 401', r.estado === 401, String(r.estado));
}
{
  const sinFirma = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    + '.' + Buffer.from(JSON.stringify({ sub: '00000000-0000-4000-aa00-000000000001', role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.';
  const r = await pedir('/usuarios/me', { token: sinFirma });
  check('Token con alg:none (sin firma): 401', r.estado === 401, String(r.estado));
}

// ============ 5. Datos que no deberían salir ============
console.log('\n═══ 5. ¿Se filtra algo que no corresponde? ═══');
{
  const r = await pedir('/clientes/me', { rol: 'ana' });
  check('La ficha propia NO trae las notas internas', !r.texto.includes('NOTA INTERNA'), r.texto.slice(0,140));
}
{
  const desde = new Date(Date.now() - 86400000).toISOString();
  const hasta = new Date(Date.now() + 30 * 86400000).toISOString();
  const r = await pedir(`/agenda/reservas?desde=${desde}&hasta=${hasta}`, { rol: 'ana' });
  const ids = (r.json ?? []).map((x) => x.id);
  check('Ana solo ve SUS clases', ids.includes(ID.claseAna) && !ids.includes(ID.claseBruno), JSON.stringify(ids));
  check('y NO ve la nota que el instructor escribió sobre ella', !r.texto.includes('NOTA DEL INSTRUCTOR'), r.texto.slice(0,120));
}
{
  const r = await pedir('/configuracion/publica');
  const claves = Object.keys(r.json ?? {});
  check('La configuración pública no expone nada de más', !claves.some((k) => /telegram|chat|token|vapid/i.test(k)), claves.join(','));
}
{
  const r = await pedir('/landing/contenido');
  check('El contenido del sitio tampoco', !/telegram|chat_id|token/i.test(r.texto), 'hay algo');
}

// ============ 6. Errores que hablan de más ============
console.log('\n═══ 6. ¿Los errores filtran tripas del sistema? ═══');
{
  const r = await pedir('/clientes/no-es-un-uuid', { rol: 'admin' });
  const feo = /prisma|postgres|at Object|\/home\/|node_modules|stack/i.test(r.texto);
  check('Un id inválido no devuelve internals', !feo, r.texto.slice(0, 140));
}
{
  const r = await pedir('/agenda/reservas?desde=no-es-fecha&hasta=tampoco', { rol: 'admin' });
  const feo = /prisma|postgres|at Object|\/home\/|node_modules/i.test(r.texto);
  check('Una fecha inválida tampoco', !feo, r.texto.slice(0, 140));
}
{
  const r = await pedir("/clientes?q=' OR 1=1--", { rol: 'admin' });
  check('Una comilla en la búsqueda no rompe nada', r.estado === 200, `${r.estado} ${r.texto.slice(0,100)}`);
}

// ============ 7. Cabeceras de seguridad ============
console.log('\n═══ 7. Cabeceras de la respuesta ═══');
{
  const r = await pedir('/configuracion/publica');
  const h = (n) => r.cabeceras.get(n);
  check('X-Content-Type-Options: nosniff', h('x-content-type-options') === 'nosniff', String(h('x-content-type-options')));
  check('No anuncia la tecnología del servidor', !h('x-powered-by'), String(h('x-powered-by')));
  check('Tiene política de referrer', Boolean(h('referrer-policy')), String(h('referrer-policy')));
  check('Tiene Content-Security-Policy', Boolean(h('content-security-policy')), 'falta');
  check('y es la mas restrictiva posible (default-src none)', /default-src 'none'/.test(h('content-security-policy') ?? ''), String(h('content-security-policy')));
  check('Obliga HTTPS (HSTS)', /max-age=\d{7,}/.test(h('strict-transport-security') ?? ''), String(h('strict-transport-security')));
  check('Impide que la incrusten en un iframe', h('x-frame-options') === 'SAMEORIGIN' || /frame-ancestors/.test(h('content-security-policy') ?? ''), String(h('x-frame-options')));
}

// ============ 8. CORS ============
console.log('\n═══ 8. CORS ═══');
{
  const r = await fetch(`${API}/configuracion/publica`, { headers: { Origin: 'https://sitio-de-un-atacante.com' } });
  const permitido = r.headers.get('access-control-allow-origin');
  check('Un origen desconocido NO recibe permiso', !permitido || permitido === 'false', String(permitido));
}
{
  const r = await fetch(`${API}/configuracion/publica`, { headers: { Origin: 'http://localhost:5175' } });
  check('Un origen conocido sí', r.headers.get('access-control-allow-origin') === 'http://localhost:5175', String(r.headers.get('access-control-allow-origin')));
}

// ============ 9. Limite de peticiones ============
console.log('\n═══ 9. Limite de peticiones ═══');
{
  const codigos = [];
  for (let i = 0; i < 9; i++) {
    const r = await pedir('/landing/contacto-whatsapp', { metodo: 'POST', cuerpo: { seccion: 'hero' } });
    codigos.push(r.estado);
  }
  check('El endpoint publico de WhatsApp corta al sexto intento', codigos.includes(429), codigos.join(','));
}

// ============ 10. Cuenta dada de baja ============
console.log('\n═══ 10. Una cuenta dada de baja deja de entrar ═══');
{
  const antes = await pedir('/usuarios/me', { rol: 'bruno' });
  check('Bruno entra normalmente', antes.estado === 200, String(antes.estado));

  await pedir(`/usuarios/00000000-0000-4000-aa00-000000000003`, { rol: 'admin', metodo: 'PATCH', cuerpo: { activo: false } });
  const despues = await pedir('/usuarios/me', { rol: 'bruno' });
  check('Con la cuenta de baja, su MISMO token deja de servir', despues.estado === 403 || despues.estado === 401, `${despues.estado} ${despues.texto.slice(0,90)}`);

  await pedir(`/usuarios/00000000-0000-4000-aa00-000000000003`, { rol: 'admin', metodo: 'PATCH', cuerpo: { activo: true } });
}

// ============ 11. Cuerpos abusivos ============
console.log('\n═══ 11. Cuerpos abusivos ═══');
{
  const gigante = 'a'.repeat(200000);
  const r = await pedir('/usuarios/me', { rol: 'ana', metodo: 'PATCH', cuerpo: { nombre: gigante, apellido: 'Alumna' } });
  check('Un nombre de 200 KB se rechaza', r.estado === 400 || r.estado === 413, `${r.estado} ${r.texto.slice(0,90)}`);
}
{
  const r = await pedir('/usuarios/me', { rol: 'ana', metodo: 'PATCH', cuerpo: { nombre: { $ne: null }, apellido: 'Alumna' } });
  check('Un objeto donde va un texto se rechaza', r.estado === 400, `${r.estado} ${r.texto.slice(0,90)}`);
}
{
  const r = await pedir('/clientes?porPagina=100000', { rol: 'admin' });
  const cuantos = r.json?.datos?.length ?? 0;
  check('No se puede pedir una pagina ilimitada', r.estado === 400 || cuantos <= 100, `${r.estado}, devolvio ${cuantos}`);
}

// ============ 12. Pagos: lo de uno no es de otro ============
// El modulo de pagos entro despues de la primera auditoria. Mueve plata y
// guarda documentos bancarios: es la superficie mas delicada que se agrego.
console.log('\n═══ 12. Pagos: ¿puede alguien tocar el pago de otro? ═══');
const pagoDeAna = await (async () => {
  const servicios = (await pedir('/catalogo/servicios')).json ?? [];
  const servicio = servicios.find((s) => Number(s.precioContado) > 0);
  if (!servicio) { check('hay un servicio con precio para poder probar pagos', false, 'ninguno activo'); return null; }
  const r = await pedir('/pagos/mios', { rol: 'ana', metodo: 'POST', cuerpo: { servicioId: servicio.id } });
  check('Ana puede empezar un pago suyo', r.estado === 201 || r.estado === 200, `${r.estado} ${r.texto.slice(0,120)}`);
  // El monto lo pone el servidor: si viniera del navegador, vendria uno.
  check('el monto sale del catalogo, no del navegador',
    Number(r.json?.monto) === Number(servicio.precioContado), `${r.json?.monto} vs ${servicio.precioContado}`);
  return r.json;
})();

if (pagoDeAna) {
  {
    const r = await pedir(`/pagos/mios/${pagoDeAna.id}/comprobante`, { rol: 'bruno', metodo: 'PATCH', cuerpo: { archivo: 'x.pdf' } });
    check('Bruno NO puede colgarle un comprobante al pago de Ana', r.estado === 404 || r.estado === 403, String(r.estado));
  }
  {
    const r = await pedir(`/pagos/${pagoDeAna.id}`, { rol: 'ana' });
    check('Ana NO puede abrir el detalle de administracion de su propio pago', r.estado === 403, String(r.estado));
  }
  {
    // La direccion firmada abre un documento bancario SIN pedir sesion: quien la
    // consigue, ve el archivo. Solo administracion puede pedirla.
    const r = await pedir(`/pagos/${pagoDeAna.id}/comprobante`, { rol: 'ana' });
    check('Ana NO puede pedir la direccion firmada del comprobante', r.estado === 403, String(r.estado));
  }
  {
    const r = await pedir(`/pagos/${pagoDeAna.id}/aprobar`, { rol: 'ana', metodo: 'POST', cuerpo: {} });
    check('Ana NO puede aprobarse un pago a si misma', r.estado === 403, String(r.estado));
  }
  {
    const r = await pedir(`/pagos/${pagoDeAna.id}/aprobar`, { rol: 'inst', metodo: 'POST', cuerpo: {} });
    check('El instructor NO puede aprobar pagos', r.estado === 403, String(r.estado));
  }
  {
    const r = await pedir('/pagos/efectivo', { rol: 'ana', metodo: 'POST', cuerpo: { clienteId: ID.fichaAna, servicioId: pagoDeAna.servicio?.id } });
    check('Ana NO puede registrarse un cobro en efectivo', r.estado === 403, String(r.estado));
  }
}
{
  const r = await pedir('/pagos', { rol: 'ana' });
  check('Ana NO puede listar los pagos de la academia', r.estado === 403, String(r.estado));
}
{
  const r = await pedir('/pagos', { rol: 'inst' });
  check('El instructor tampoco', r.estado === 403, String(r.estado));
}
{
  const r = await pedir('/pagos/mios', { rol: 'bruno' });
  const ajenos = (r.json ?? []).length;
  check('Bruno solo ve SUS pagos', r.estado === 200 && ajenos === 0, `${r.estado}, ${ajenos} pagos`);
}
{
  const r = await pedir('/pagos/mios', { rol: 'ana' });
  const campos = new Set((r.json ?? []).flatMap((p) => Object.keys(p)));
  // La nota es interna y la ruta, con la clave de servicio, llega al archivo.
  check('el alumno NO recibe la nota interna ni la ruta del comprobante',
    !campos.has('nota') && !campos.has('comprobantePath') && !campos.has('verificadoPor'),
    [...campos].join(','));
}

// ============ 13. Pagos: el nombre del archivo ============
// La API compone la ruta del bucket con el id de la sesion y el del pago, y del
// cuerpo toma SOLO el nombre. Si aceptara una ruta, se podria apuntar al
// comprobante de otra persona y despues pedir que lo muestren.
console.log('\n═══ 13. Pagos: ¿se puede escapar de la carpeta propia? ═══');
if (pagoDeAna) {
  const nombresProhibidos = [
    ['../../otro/comprobante.pdf', 'subir un nivel'],
    ['..%2F..%2Fotro.pdf', 'subir un nivel codificado'],
    ['/etc/passwd', 'ruta absoluta'],
    ['carpeta/archivo.pdf', 'una barra en el medio'],
    ['comprobante.pdf\u0000.png', 'byte nulo'],
    ['comprobante.svg', 'SVG, que puede traer scripts'],
    ['comprobante.html', 'HTML'],
    ['comprobante.php', 'codigo de servidor'],
    ['comprobante', 'sin extension'],
    ['COMPROBANTE.PDF', 'mayusculas, que el bucket no espera'],
    [`${'a'.repeat(200)}.pdf`, 'nombre larguisimo'],
  ];
  for (const [archivo, motivo] of nombresProhibidos) {
    const r = await pedir(`/pagos/mios/${pagoDeAna.id}/comprobante`, { rol: 'ana', metodo: 'PATCH', cuerpo: { archivo } });
    check(`rechaza ${motivo}`, r.estado === 400, `${r.estado} ${r.texto.slice(0, 80)}`);
  }
  {
    const r = await pedir(`/pagos/mios/${pagoDeAna.id}/comprobante`, { rol: 'ana', metodo: 'PATCH', cuerpo: { archivo: 'comprobante-1.pdf' } });
    check('y acepta un nombre normal', r.estado === 200, `${r.estado} ${r.texto.slice(0,90)}`);
  }
}

// ============ 14. Pagos: importes ============
console.log('\n═══ 14. Pagos: importes que no deberian entrar ═══');
{
  const servicios = (await pedir('/catalogo/servicios')).json ?? [];
  const servicio = servicios.find((s) => Number(s.precioContado) > 0);
  if (servicio) {
    const r = await pedir('/pagos/mios', { rol: 'ana', metodo: 'POST', cuerpo: { servicioId: servicio.id, monto: 1 } });
    check('el alumno NO puede mandar el monto en el cuerpo', r.estado === 400, `${r.estado} ${r.texto.slice(0,90)}`);
  }
}
{
  const pago = (await pedir('/pagos?estado=PENDIENTE&porPagina=10', { rol: 'admin' })).json?.datos?.[0];
  if (pago) {
    for (const [monto, motivo] of [[-100, 'negativo'], [0, 'cero'], [1.5, 'con centavos'], [999999999, 'absurdo']]) {
      const r = await pedir(`/pagos/${pago.id}/aprobar`, { rol: 'admin', metodo: 'POST', cuerpo: { monto } });
      check(`no se aprueba con un monto ${motivo}`, r.estado === 400, `${r.estado} ${r.texto.slice(0,70)}`);
    }
    const r = await pedir(`/pagos/${pago.id}/rechazar`, { rol: 'admin', metodo: 'POST', cuerpo: { motivo: '   ' } });
    check('no se rechaza sin escribir un motivo', r.estado === 400, `${r.estado} ${r.texto.slice(0,70)}`);
  } else {
    check('hay un pago pendiente para probar importes', false, 'ninguno');
  }
}

// ============ 15. Tablero ============
// Devuelve la facturacion de la academia y el rendimiento de cada instructor.
console.log('\n═══ 15. Tablero: solo administracion ═══');
for (const rol of ['ana', 'inst']) {
  const r = await pedir('/tablero', { rol });
  check(`${rol} NO puede abrir el tablero`, r.estado === 403, String(r.estado));
}
{
  const r = await pedir('/tablero', { token: '' });
  check('sin sesion tampoco', r.estado === 401, String(r.estado));
}
for (const [consulta, motivo] of [
  ['?desde=ayer', 'una fecha en palabras'],
  ["?desde=2026-01-01'--", 'una comilla en la fecha'],
  ['?desde=2026-09-10&hasta=2026-09-01', 'un rango invertido'],
  ['?desde=1990-01-01&hasta=2026-01-01', 'un rango de treinta anios'],
  ['?otro=1', 'un parametro que no existe'],
]) {
  const r = await pedir(`/tablero${consulta}`, { rol: 'admin' });
  check(`rechaza ${motivo}`, r.estado === 400, `${r.estado} ${r.texto.slice(0,80)}`);
}
{
  const r = await pedir('/tablero', { rol: 'admin' });
  const texto = JSON.stringify(r.json ?? {});
  // Agrega: no tiene por que llevar ni un nombre de alumno ni un identificador.
  check('el tablero no arrastra datos personales', r.estado === 200 && !/documento|telefono|email/i.test(texto), texto.slice(0,120));
}

// ============ 16. La galeria publica ============
// Ruta nueva, PUBLICA y sin sesion: lo que salga de aca lo ve internet.
console.log('\n═══ 16. Galeria de egresados (publica) ═══');
{
  const r = await pedir('/graduados/galeria', { token: '' });
  check('contesta sin sesion, que es para lo que existe', r.estado === 200, String(r.estado));
  const gente = (r.json ?? []).flatMap((a) => a.graduados ?? []);
  const campos = new Set(gente.flatMap((g) => Object.keys(g)));
  const permitidos = ['id', 'nombre', 'apellido', 'categoria', 'anio', 'fotoUrl'];
  check('publica SOLO los seis campos previstos',
    [...campos].every((c) => permitidos.includes(c)), [...campos].join(','));
  check('ningun anio pasa el tope de 24 fotos',
    (r.json ?? []).every((a) => (a.graduados ?? []).length <= 24),
    (r.json ?? []).map((a) => `${a.anio}:${a.graduados.length}`).join(' '));
  check('no devuelve mas de 12 anios', (r.json ?? []).length <= 12, String((r.json ?? []).length));
}
{
  // La ruta vieja se elimino. No contesta 404 sino 401, porque el camino lo
  // absorbe `GET /graduados/:id`, que pide ADMIN: el guard corta antes de que
  // nadie mire si «anios» es un identificador. Lo que importa no es el numero
  // sino que ya NO entregue la lista de anios a quien no tiene sesion.
  const r = await pedir('/graduados/anios', { token: '' });
  check('la lista de anios ya no se sirve sin sesion',
    r.estado !== 200 && !Array.isArray(r.json), `${r.estado} ${r.texto.slice(0,60)}`);
  const conSesion = await pedir('/graduados/anios', { rol: 'admin' });
  check('y tampoco con sesion: el camino quedo como un id invalido',
    conSesion.estado === 400 || conSesion.estado === 404, String(conSesion.estado));
}

// ============ 17. El buscador de alumnos ============
// Lo usa el alta de egresado y el cobro en efectivo. Busca por cedula.
console.log('\n═══ 17. El buscador de alumnos ═══');
for (const rol of ['ana', 'inst']) {
  const r = await pedir('/clientes?q=a', { rol });
  check(`${rol} NO puede usar el buscador de alumnos`, r.estado === 403, String(r.estado));
}
{
  const r = await pedir("/clientes?q=' OR 1=1 --", { rol: 'admin' });
  check('una inyeccion en el buscador no devuelve la tabla entera',
    r.estado === 200 && (r.json?.datos?.length ?? 0) === 0, `${r.estado}, ${r.json?.datos?.length} resultados`);
}
{
  const r = await pedir(`/clientes?q=${'a'.repeat(500)}`, { rol: 'admin' });
  check('una busqueda gigante se rechaza', r.estado === 400, String(r.estado));
}

// ============ 18. El interruptor de avisos nuevo ============
console.log('\n═══ 18. Avisos ═══');
for (const rol of ['ana', 'inst']) {
  const r = await pedir('/avisos/telegram', { rol, metodo: 'PATCH', cuerpo: { avisaPagoNuevo: false } });
  check(`${rol} NO puede tocar los avisos de la academia`, r.estado === 403, String(r.estado));
}
{
  const r = await pedir('/avisos/telegram', { rol: 'admin' });
  check('la API nunca devuelve el token del bot',
    r.estado === 200 && !JSON.stringify(r.json).includes('token') || !/\d{8,}:[A-Za-z0-9_-]{30,}/.test(JSON.stringify(r.json)),
    JSON.stringify(r.json).slice(0, 100));
}

// ============ 19. Campos de mas en el cuerpo (asignacion masiva) ============
// El peligro no es que el campo exista: es que el servicio lo copie tal cual al
// registro. `forbidNonWhitelisted` corta antes, pero conviene comprobarlo en la
// superficie que mueve plata y estados, no confiar en que sigue puesto.
console.log('\n═══ 19. ¿Se puede colar un campo de mas? ═══');
{
  const servicios = (await pedir('/catalogo/servicios')).json ?? [];
  const servicio = servicios.find((s) => Number(s.precioContado) > 0);
  const intentos = [
    [{ servicioId: servicio?.id, estado: 'APROBADO' }, 'nacer aprobado'],
    [{ servicioId: servicio?.id, clienteId: ID.fichaBruno }, 'ponerlo a nombre de otro'],
    [{ servicioId: servicio?.id, comprobantePath: 'otro/archivo.pdf' }, 'fijar la ruta del archivo'],
    [{ servicioId: servicio?.id, verificadoPor: ID.fichaAna }, 'decir quien lo verifico'],
    [{ servicioId: servicio?.id, canal: 'EFECTIVO' }, 'cambiar la forma de pago'],
  ];
  for (const [cuerpo, motivo] of intentos) {
    const r = await pedir('/pagos/mios', { rol: 'ana', metodo: 'POST', cuerpo });
    check(`no se puede ${motivo}`, r.estado === 400, `${r.estado} ${r.texto.slice(0,70)}`);
  }
}
{
  const r = await pedir('/usuarios/me', { rol: 'ana', metodo: 'PATCH', cuerpo: { nombre: 'Ana', apellido: 'A', activo: false } });
  check('nadie se cambia el campo «activo» desde su perfil', r.estado === 400, String(r.estado));
}

// ============ 20. Metodos que no existen ============
console.log('\n═══ 20. Metodos HTTP que no corresponden ═══');
{
  const pago = (await pedir('/pagos?porPagina=10', { rol: 'admin' })).json?.datos?.[0];
  if (pago) {
    for (const metodo of ['DELETE', 'PUT']) {
      const r = await pedir(`/pagos/${pago.id}`, { rol: 'admin', metodo });
      check(`un pago no se puede ${metodo}`, r.estado === 404 || r.estado === 405, `${r.estado}`);
    }
  }
}

// ============ 21. Enumerar identificadores ============
// «No existe» y «no es tuyo» tienen que contestar lo MISMO. Si se distinguen,
// probar identificadores dice cuales existen.
console.log('\n═══ 21. ¿Se pueden enumerar identificadores? ═══');
{
  const inexistente = '00000000-0000-4000-9999-999999999999';
  const deOtro = (await pedir('/pagos?porPagina=10', { rol: 'admin' })).json?.datos?.[0]?.id;
  if (deOtro) {
    const a = await pedir(`/pagos/mios/${inexistente}/comprobante`, { rol: 'bruno', metodo: 'PATCH', cuerpo: { archivo: 'c.pdf' } });
    const b = await pedir(`/pagos/mios/${deOtro}/comprobante`, { rol: 'bruno', metodo: 'PATCH', cuerpo: { archivo: 'c.pdf' } });
    check('«no existe» y «no es tuyo» contestan lo mismo',
      a.estado === b.estado && a.json?.message === b.json?.message,
      `${a.estado}:${a.json?.message} vs ${b.estado}:${b.json?.message}`);
  }
}
{
  // Una direccion de correo que existe y una que no tienen que verse igual.
  const r = await pedir('/graduados/verificar/CODIGOQUENOEXISTE', { token: '' });
  check('un codigo de diploma inexistente no habla de mas',
    r.estado === 404 || r.json?.valido === false, `${r.estado} ${r.texto.slice(0,70)}`);
}

// ============ 22. Limite de peticiones en las rutas nuevas ============
// La galeria es PUBLICA y hace una consulta por anio. Sin limite global seria
// una forma barata de hacer trabajar a la base desde internet.
console.log('\n═══ 22. Limite en la galeria publica ═══');
{
  const limite = Number(process.env.THROTTLE_LIMITE ?? 100);
  let cortado = 0;
  for (let i = 0; i < limite + 20; i++) {
    const r = await pedir('/graduados/galeria', { token: '' });
    if (r.estado === 429) { cortado = i + 1; break; }
  }
  check('la galeria publica cae bajo el limite global de peticiones',
    cortado > 0 && cortado <= limite + 5, cortado ? `corto en la ${cortado}` : 'NO corto nunca');
}

// ============ 23. Los manuales ============
// Entraron despues de la segunda auditoria. No agregan ninguna ruta a la API
// —son texto compilado dentro de cada aplicacion—, y eso es justamente lo que
// hay que confirmar: que no se haya colado una superficie nueva sin querer.
console.log('\n═══ 23. Los manuales no abrieron superficie nueva ═══');
for (const ruta of ['/manuales', '/manual', '/ayuda']) {
  const r = await pedir(ruta, { token: '' });
  check(`la API no sirve ${ruta}`, r.estado === 404, String(r.estado));
}
{
  const r = await pedir('/manuales', { rol: 'admin' });
  check('tampoco con sesion de administracion', r.estado === 404, String(r.estado));
}

console.log(`\n${ok} bien, ${fallos.length} mal`);
if (fallos.length) {
  console.log('\nPENDIENTES:\n' + fallos.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
