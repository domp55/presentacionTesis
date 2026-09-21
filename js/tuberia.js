/* ══════════════════════════════════════════════════════════════
   ANALOGÍA DE LA TUBERÍA — animación del flujo de peticiones
   Uso en el .qmd:
     <div class="tuberia" data-escena="carga"></div>
     <div class="tb-pasos"><span class="fragment" data-modo="media"></span>…</div>
   Cada fragmento con data-modo cambia el estado de la animación.
   Las cifras mostradas son las de la tesis (Tablas 12 y 17); la
   simulación solo ilustra el comportamiento, no calcula resultados.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var VEL = 420;        // px/s de las gotas
  var HUECO = 13;       // separación mínima entre gotas en cola
  var X_LLAVE = 790;
  var X_FIN = 1150;

  var ESCENAS = {
    // Rendimiento por nivel de carga (Tabla 12, escenario con refrigeración)
    carga: {
      geometria: 'lineal',
      inicial: 'baja',
      modos: {
        baja: {
          etiqueta: '50 personas', personas: 50, ruta: 'central', cadaSeg: 1.75, servicio: [0.2, 0.2],
          titular: '50 personas: el agua fluye sin espera',
          bajada: 'Cada pedido llega a un grifo, la llave abre y el vaso sale de inmediato.',
          tarjetas: [
            { t: 'Vasos por segundo', v: '40', d: 'throughput', clave: true },
            { t: 'Espera por vaso', v: '3.6 ms', d: 'latencia · percentil 95', clave: true },
            { t: 'Pedidos perdidos', v: '0 %', d: 'tasa de fallos' }
          ],
          dato: '50 usuarios virtuales (K6) · 39.97 peticiones/s · latencia p95 3.60 ms · 0.00 % de fallos'
        },
        media: {
          etiqueta: '200 personas', personas: 200, ruta: 'central', cadaSeg: 0.22, servicio: [0.2, 0.2],
          titular: '200 personas: ocho veces más pedidos y sigue sin espera',
          bajada: 'Las tres llaves todavía alcanzan a atender cada pedido apenas llega.',
          tarjetas: [
            { t: 'Vasos por segundo', v: '318', d: 'throughput', clave: true },
            { t: 'Espera por vaso', v: '3.8 ms', d: 'latencia · percentil 95', clave: true },
            { t: 'Pedidos perdidos', v: '0 %', d: 'tasa de fallos' }
          ],
          dato: '200 usuarios virtuales · 317.91 peticiones/s · latencia p95 3.82 ms · 0.00 % de fallos'
        },
        alta: {
          etiqueta: '500 personas', personas: 500, ruta: 'central', enVuelo: 96, servicio: [0.2, 0.2],
          titular: '500 personas: los pedidos hacen cola ante las llaves',
          bajada: 'Cada persona espera casi 200 veces más. Y ningún pedido se pierde.',
          tarjetas: [
            { t: 'Vasos por segundo', v: '915', d: 'throughput', clave: true },
            { t: 'Espera por vaso', v: '700 ms', d: 'latencia · percentil 95', clave: true },
            { t: 'Pedidos perdidos', v: '0 %', d: 'tasa de fallos' }
          ],
          dato: '500 usuarios virtuales sin pausa · 915.50 peticiones/s · latencia p95 700.22 ms (media 437.10 ms) · 0.00 % de fallos · coeficiente de variación < 0.6 %'
        }
      }
    },

    // Experimento complementario: tráfico centralizado frente a distribuido (Tabla 17)
    reparto: {
      geometria: 'desvio',
      inicial: 'central',
      modos: {
        central: {
          etiqueta: 'Centralizado', personas: 500, ruta: 'central', enVuelo: 96, servicio: [0.2, 0.2],
          titular: 'Original: todos los pedidos pasan por la estación central',
          bajada: '¿Y si el atasco está en la estación central, por concentrar todo el tráfico?',
          tarjetas: [
            { t: 'Vasos por segundo', v: '915', d: 'throughput', clave: true },
            { t: 'Espera por vaso', v: '700 ms', d: 'latencia · percentil 95', clave: true },
            { t: 'Espera máxima', v: '1.2 s', d: 'latencia máxima' },
            { t: 'Fuerza de bomba usada', v: '≈ 28 %', d: 'procesador de los trabajadores' }
          ],
          dato: 'Tráfico centralizado: 192.168.10.10:32080 (NodePort en el maestro) · 915.50 ± 3.25 peticiones/s · p95 700.22 ± 2.47 ms'
        },
        repartido: {
          etiqueta: 'Distribuido', personas: 500, ruta: 'directa', enVuelo: 96, servicio: [0.04, 0.34],
          titular: 'Experimento: los pedidos van directo a los tres grifos',
          bajada: 'Casi los mismos vasos por segundo, y la espera se vuelve más irregular: el atasco no estaba en la estación central.',
          tarjetas: [
            { t: 'Vasos por segundo', v: '947', d: 'apenas +3.4 %', clave: true },
            { t: 'Espera por vaso', v: '870 ms', d: 'percentil 95 · +24 %', clave: true },
            { t: 'Espera máxima', v: '4.3 s', d: '+263 %' },
            { t: 'Fuerza de bomba usada', v: '≈ 35 %', d: 'procesador de los trabajadores' }
          ],
          dato: 'Tráfico repartido al azar entre .11, .12 y .13 (NodePort 32080) · 946.96 ± 3.33 peticiones/s · p95 870.13 ± 38.26 ms: 15 veces más variable'
        }
      }
    }
  };

  function svgEl(tag, attrs, padre) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }
  function htmlEl(tag, clase, padre, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    if (padre) padre.appendChild(n);
    return n;
  }

  function geometria(tipo) {
    if (tipo === 'desvio') {
      return {
        vista: '0 0 1280 500', yTronco: 300, ramales: [170, 300, 430],
        fila: { x: 20, y: 215, w: 195, h: 170 },
        maestro: { x: 295, y: 12, w: 250, h: 106 },
        tubos: ['M215 300 H260', 'M570 300 H1150', 'M610 300 V170 H1150', 'M610 300 V430 H1150'],
        tubosDesvio: ['M260 300 V65 H570 V300'],
        tubosDirecto: ['M260 300 H570'],
        ruta: function (clave, y) {
          var ini = clave === 'central'
            ? [[215, 300], [260, 300], [260, 65], [570, 65], [570, 300], [610, 300]]
            : [[215, 300], [610, 300]];
          return ini.concat(y === 300 ? [[X_FIN, 300]] : [[610, y], [X_FIN, y]]);
        }
      };
    }
    return {
      vista: '0 0 1280 470', yTronco: 250, ramales: [95, 250, 405],
      fila: { x: 20, y: 165, w: 195, h: 170 },
      maestro: { x: 295, y: 190, w: 250, h: 120 },
      tubos: ['M215 250 H1150', 'M610 250 V95 H1150', 'M610 250 V405 H1150'],
      tubosDesvio: [], tubosDirecto: [],
      ruta: function (clave, y) {
        return y === 250 ? [[215, 250], [X_FIN, 250]] : [[215, 250], [610, 250], [610, y], [X_FIN, y]];
      }
    };
  }

  function prepararRuta(pts) {
    var seg = [], total = 0;
    for (var i = 1; i < pts.length; i++) {
      var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (l === 0) continue;
      seg.push({ a: pts[i - 1], b: pts[i], ini: total, l: l });
      total += l;
    }
    return { seg: seg, total: total, sLlave: total - (X_FIN - X_LLAVE), gotas: [], sirviendo: null, ocupadaHasta: 0 };
  }
  function punto(r, s) {
    var g = r.seg[r.seg.length - 1];
    for (var i = 0; i < r.seg.length; i++) { if (s <= r.seg[i].ini + r.seg[i].l) { g = r.seg[i]; break; } }
    var t = Math.min(1, Math.max(0, (s - g.ini) / g.l));
    return [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t];
  }

  function dibujarTubos(padre, lista) {
    var g = svgEl('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, padre);
    lista.forEach(function (d) { svgEl('path', { d: d, stroke: 'var(--tb-tubo-borde)', 'stroke-width': 30 }, g); });
    lista.forEach(function (d) { svgEl('path', { d: d, stroke: 'var(--tb-tubo)', 'stroke-width': 24 }, g); });
    return g;
  }

  function crear(cont) {
    var esc = ESCENAS[cont.dataset.escena];
    if (!esc) return null;
    var geo = geometria(esc.geometria);
    var conTarjetas = cont.dataset.tarjetas !== 'no';
    var conTitular = cont.dataset.titular !== 'no';
    var conDato = cont.dataset.dato !== 'no';

    // Estados de la animación: el inicial más uno por cada fragmento con data-modo de la slide
    var seccion = cont.closest('section');
    var pasos = seccion ? Array.prototype.slice.call(seccion.querySelectorAll('.fragment[data-modo]')) : [];
    var secuencia = [cont.dataset.inicial || esc.inicial].concat(pasos.map(function (p) { return p.dataset.modo; }));

    cont.textContent = '';
    var cabecera = conTitular ? htmlEl('div', 'tb-cabecera', cont) : null;
    var textos = cabecera ? htmlEl('div', 'tb-textos', cabecera) : null;
    var titular = conTitular ? htmlEl('div', 'tb-titular', textos) : null;
    var bajada = conTitular ? htmlEl('div', 'tb-bajada', textos) : null;

    // Pestañas: dejan ver que es UNA slide con varios estados; se pueden pulsar,
    // y también avanzan con las flechas o el puntero (siguen siendo fragmentos).
    var pestanas = [];
    if (cabecera && pasos.length) {
      var barra = htmlEl('div', 'tb-pestanas', cabecera);
      secuencia.forEach(function (clave, k) {
        var b = htmlEl('button', 'tb-pestana', barra, (esc.modos[clave] || {}).etiqueta || clave);
        b.type = 'button';
        b.dataset.modo = clave;
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var R = window.Reveal;
          if (R && R.getIndices) { var ix = R.getIndices(seccion); R.slide(ix.h, ix.v, k - 1); }
        });
        pestanas.push(b);
      });
    }

    var svg = svgEl('svg', { viewBox: geo.vista, role: 'img', 'aria-label': 'Animación: los pedidos de agua viajan por la tubería hasta tres grifos' }, cont);
    dibujarTubos(svg, geo.tubos);
    var gDirecto = dibujarTubos(svg, geo.tubosDirecto);
    var gDesvio = dibujarTubos(svg, geo.tubosDesvio);
    var gGotas = svgEl('g', {}, svg);

    // Fila de personas
    var f = geo.fila;
    svgEl('rect', { x: f.x, y: f.y, width: f.w, height: f.h, rx: 12, fill: 'var(--unl-azul-oscuro)' }, svg);
    svgEl('text', { 'class': 'tb-rot', x: f.x + f.w / 2, y: f.y + 30 }, svg).textContent = 'Fila de personas';
    svgEl('text', { 'class': 'tb-rot-sub', x: f.x + f.w / 2, y: f.y + 51 }, svg).textContent = 'cada una pide un vaso';
    var gPersonas = svgEl('g', {}, svg);
    svgEl('text', { 'class': 'tb-nota', x: f.x + f.w / 2, y: f.y + f.h + 22 }, svg).textContent = '1 punto = 10 personas';

    // Estación central (maestro)
    var m = geo.maestro;
    var gMaestro = svgEl('g', {}, svg);
    svgEl('rect', { x: m.x, y: m.y, width: m.w, height: m.h, rx: 12, fill: 'var(--unl-azul-oscuro)' }, gMaestro);
    svgEl('text', { 'class': 'tb-rot', x: m.x + m.w / 2, y: m.y + m.h / 2 - 12 }, gMaestro).textContent = 'Estación central';
    svgEl('text', { 'class': 'tb-rot-sub', x: m.x + m.w / 2, y: m.y + m.h / 2 + 10 }, gMaestro).textContent = 'nodo maestro · Raspberry Pi 4';
    svgEl('text', { 'class': 'tb-rot-sub', x: m.x + m.w / 2, y: m.y + m.h / 2 + 30 }, gMaestro).textContent = 'reparte los pedidos';

    // Llaves y grifos (trabajadores)
    var manijas = geo.ramales.map(function (y, i) {
      svgEl('rect', { x: 855, y: y - 38, width: 250, height: 76, rx: 12, fill: 'var(--tb-caja)' }, svg);
      svgEl('text', { 'class': 'tb-rot', x: 980, y: y - 6 }, svg).textContent = 'Grifo ' + (i + 1);
      svgEl('text', { 'class': 'tb-rot-sub', x: 980, y: y + 17 }, svg).textContent = 'trabajador · Raspberry Pi 3';
      svgEl('circle', { cx: X_LLAVE, cy: y, r: 24, fill: '#fff', stroke: 'var(--unl-rojo)', 'stroke-width': 5 }, svg);
      var manija = svgEl('rect', { x: X_LLAVE - 5, y: y - 21, width: 10, height: 42, rx: 5, fill: 'var(--unl-rojo)' }, svg);
      svgEl('text', { 'class': 'tb-nota-roja', x: i === 0 ? X_LLAVE - 45 : X_LLAVE, y: y - 34 }, svg).textContent = i === 0 ? 'llave = puerto de red' : 'llave';
      return manija;
    });
    svgEl('text', { 'class': 'tb-nota', x: 1215, y: geo.yTronco - 5 }, svg).textContent = 'vasos';
    svgEl('text', { 'class': 'tb-nota', x: 1215, y: geo.yTronco + 14 }, svg).textContent = 'servidos';

    var tarjetas = conTarjetas ? htmlEl('div', 'tb-tarjetas', cont) : null;
    var dato = conDato ? htmlEl('div', 'dato-tecnico', cont) : null;
    var datoTxt = dato ? htmlEl('span', null, dato) : null;

    var conjuntos = {};
    ['central', 'directa'].forEach(function (clave) {
      conjuntos[clave] = geo.ramales.map(function (y) { return prepararRuta(geo.ruta(clave, y)); });
    });

    var giros = [0, 0, 0];
    var modo = null, claveModo = null, rutas = conjuntos.central;
    var reloj = 0, acumulado = 0, proxRuta = 0, ultimaGota = null;
    var raf = 0, previo = 0;

    function limpiar() {
      Object.keys(conjuntos).forEach(function (k) {
        conjuntos[k].forEach(function (r) { r.gotas = []; r.sirviendo = null; r.ocupadaHasta = 0; });
      });
      gGotas.textContent = '';
      ultimaGota = null; acumulado = 0;
    }
    function enVuelo() { var n = 0; rutas.forEach(function (r) { n += r.gotas.length; }); return n; }
    function nuevaGota() {
      // Una sola gota a la vez en la boca del tubo (las rutas comparten el tramo inicial)
      if (ultimaGota && ultimaGota.s < HUECO) return;
      var r = rutas[proxRuta]; proxRuta = (proxRuta + 1) % rutas.length;
      ultimaGota = { s: 0, servida: false, nodo: svgEl('circle', { r: 5.5, fill: 'var(--tb-agua)' }, gGotas) };
      r.gotas.push(ultimaGota);
    }

    function paso(dt) {
      reloj += dt;
      if (modo.enVuelo) {
        // Lazo cerrado: cada persona vuelve a pedir apenas recibe su vaso (K6 sin pausa)
        if (enVuelo() < modo.enVuelo) nuevaGota();
      } else {
        acumulado += dt;
        while (acumulado >= modo.cadaSeg) { acumulado -= modo.cadaSeg; nuevaGota(); }
      }
      rutas.forEach(function (r, i) {
        if (r.sirviendo && reloj >= r.ocupadaHasta) { r.sirviendo.servida = true; r.sirviendo = null; }
        for (var k = 0; k < r.gotas.length; k++) {
          var g = r.gotas[k];
          if (g === r.sirviendo) continue;
          var destino = g.s + VEL * dt;
          if (!g.servida) {
            var delante = r.gotas[k - 1];
            var tope = r.sLlave;
            if (delante && !delante.servida) tope = Math.min(tope, delante.s - HUECO);
            destino = Math.min(destino, tope);
            if (destino >= r.sLlave - 0.01 && !r.sirviendo) {
              r.sirviendo = g;
              r.duracion = modo.servicio[0] + Math.random() * (modo.servicio[1] - modo.servicio[0]);
              r.ocupadaHasta = reloj + r.duracion;
              destino = r.sLlave;
            }
          }
          g.s = Math.max(g.s, destino);
        }
        // La manija gira mientras la llave atiende un vaso
        var objetivo = r.sirviendo ? 90 * Math.sin(Math.PI * (1 - (r.ocupadaHasta - reloj) / r.duracion)) : 0;
        giros[i] += (objetivo - giros[i]) * 0.5;
        manijas[i].setAttribute('transform', 'rotate(' + giros[i].toFixed(1) + ' ' + X_LLAVE + ' ' + geo.ramales[i] + ')');
        r.gotas = r.gotas.filter(function (g) {
          if (g.s >= r.total) { g.nodo.remove(); return false; }
          var p = punto(r, g.s);
          g.nodo.setAttribute('cx', p[0].toFixed(1));
          g.nodo.setAttribute('cy', p[1].toFixed(1));
          g.nodo.setAttribute('opacity', g.s > r.total - 60 ? ((r.total - g.s) / 60).toFixed(2) : 1);
          return true;
        });
      });
    }

    function cuadro(ahora) {
      var dt = Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      paso(dt);
      raf = requestAnimationFrame(cuadro);
    }

    function pintarTarjetas() {
      if (!tarjetas) return;
      tarjetas.textContent = '';
      modo.tarjetas.forEach(function (c) {
        var t = htmlEl('div', 'tb-tarjeta' + (c.clave ? ' clave' : ''), tarjetas);
        htmlEl('div', 't', t, c.t);
        htmlEl('div', 'v', t, c.v);
        htmlEl('div', 'd', t, c.d);
      });
    }

    var api = {
      cont: cont,
      escena: esc,
      fijarModo: function (clave) {
        if (!esc.modos[clave] || clave === claveModo) return;
        claveModo = clave; modo = esc.modos[clave];
        rutas = conjuntos[modo.ruta];
        limpiar();
        if (titular) { titular.textContent = modo.titular; bajada.textContent = modo.bajada; }
        if (datoTxt) datoTxt.textContent = modo.dato;
        pintarTarjetas();
        pestanas.forEach(function (b) { b.classList.toggle('activa', b.dataset.modo === clave); });
        var central = modo.ruta === 'central';
        gDesvio.setAttribute('class', central ? 'tb-activo' : 'tb-atenuado');
        gDirecto.setAttribute('class', central ? 'tb-atenuado' : 'tb-activo');
        if (esc.geometria === 'desvio') gMaestro.setAttribute('class', central ? 'tb-activo' : 'tb-atenuado');
        gPersonas.textContent = '';
        for (var k = 0; k < modo.personas / 10; k++) {
          svgEl('circle', { cx: f.x + 22 + (k % 10) * 16.8, cy: f.y + 74 + Math.floor(k / 10) * 18, r: 5.5, fill: '#fff', opacity: 0.92 }, gPersonas);
        }
        // Estado poblado desde el primer cuadro (y para la exportación a PDF)
        for (var n = 0; n < 420; n++) paso(1 / 60);
      },
      iniciar: function () { if (!raf) { previo = performance.now(); raf = requestAnimationFrame(cuadro); } },
      detener: function () { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    };
    return api;
  }

  var instancias = [];

  function modoSegunFragmentos(inst) {
    var sec = inst.cont.closest('section');
    var vis = sec ? sec.querySelectorAll('.fragment.visible[data-modo]') : [];
    return vis.length ? vis[vis.length - 1].dataset.modo : (inst.cont.dataset.inicial || inst.escena.inicial);
  }

  function sincronizar() {
    var R = window.Reveal;
    var actual = R && R.getCurrentSlide ? R.getCurrentSlide() : null;
    instancias.forEach(function (inst) {
      inst.fijarModo(modoSegunFragmentos(inst));
      if (!actual || inst.cont.closest('section') === actual) inst.iniciar(); else inst.detener();
    });
  }

  function arrancar() {
    document.querySelectorAll('.tuberia[data-escena]').forEach(function (c) {
      var inst = crear(c);
      if (inst) instancias.push(inst);
    });
    var R = window.Reveal;
    if (R && R.on) {
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function (ev) { R.on(ev, sincronizar); });
    }
    sincronizar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
