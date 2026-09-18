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

console.log(`\n${ok} bien, ${fallos.length} mal`);
if (fallos.length) {
  console.log('\nPENDIENTES:\n' + fallos.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
