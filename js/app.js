/* RutaIbagué user interface: collects the request, calls the agent and shows the decision. */
(function () {
  var REPO_URL = 'https://github.com/rosembergcardona-cmd/rutasIbague';
  var VIEWBOX = '-75.30,4.50,-75.10,4.38';           // Ibagué bounding box for address search
  var $ = function (i) { return document.getElementById(i); };
  var G, map, state = { o: null, d: null, clicks: 0 };
  $('repoLink').href = REPO_URL;

  function loadNetwork() {
    return GTFS.load('data/gtfs/').catch(function () {
      if (window.GTFS_BUNDLE) return GTFS.build(window.GTFS_BUNDLE);
      throw new Error('No se pudieron cargar los datos de la red.');
    });
  }
  function fmtH(h) {
    h = ((h % 24) + 24) % 24; var hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
    var ap = hh < 12 ? 'a. m.' : 'p. m.', h12 = hh % 12 === 0 ? 12 : hh % 12; return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }
  function m(x) { return Math.round(x) + ' min'; }
  function km(x) { return x >= 1000 ? (x / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(x) + ' m'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function status(msg) { $('status').textContent = msg || ''; }
  function mode() { return document.querySelector('input[name=m]:checked').value; }
  function hour() { return +$('h').value; }
  function updHour() { $('hv').textContent = fmtH(hour()); $('cv').textContent = Agent.context(hour()).period; }

  // ---- place resolution: stop names first, then OpenStreetMap Nominatim ----
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function findStop(q) {
    var n = norm(q); if (!n) return null; var best = null;
    for (var id in G.S) { var s = norm(G.S[id].name); if (s === n) return id; if (!best && (s.indexOf(n) === 0 || (n.length > 3 && s.indexOf(n) >= 0))) best = id; }
    return best;
  }
  function geocode(q) {
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=co&bounded=1&viewbox=' + VIEWBOX +
      '&accept-language=es&q=' + encodeURIComponent(q + ', Ibagué, Tolima');
    return fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (a) { if (!a.length) return null; return { ll: [+a[0].lat, +a[0].lon], label: a[0].display_name.split(',').slice(0, 2).join(',') }; });
  }
  function resolve(which) {
    var inp = $(which + 'q'), q = inp.value.trim();
    if (!q) return Promise.resolve(false);
    if (state[which] && state[which].label === q) return Promise.resolve(true);
    var id = findStop(q);
    if (id) { set(which, G.S[id].ll, G.S[id].name); return Promise.resolve(true); }
    status('Buscando “' + q + '”…');
    return geocode(q).then(function (r) {
      if (!r) { status('No encontré “' + q + '” en Ibagué. Prueba con otro nombre o toca el mapa.'); return false; }
      set(which, r.ll, r.label); status(''); return true;
    }).catch(function () { status('La búsqueda de direcciones necesita internet. Escoge un paradero de la lista o toca el mapa.'); return false; });
  }
  function set(which, ll, label) { state[which] = { ll: ll, label: label }; $(which + 'q').value = label; }

  // ---- agent call and rendering ----
  function run() {
    if (!state.o || !state.d) { map.setEnds(state.o && state.o.ll, state.d && state.d.ll); map.setPlan(null); return; }
    var h = hour(), md = mode(), o = state.o.ll, d = state.d.ll;
    var rec = Agent.recommend(G, o, d, h, md), out = $('result');
    map.setEnds(o, d);
    writeURL();
    if (rec.decision === 'abstain') { map.setPlan(null); out.innerHTML = '<div class="alert"><strong>Sin recomendación.</strong> ' + esc(rec.msg) + '</div>'; return; }
    var p = rec.plan; map.setPlan(p);
    var legs = p.legs.filter(function (L) { return L.type !== 'walk' || L.m > 5; });
    var li = legs.map(function (L) {
      if (L.type === 'walk') return '<li class="walk"><span class="nd"></span><span>Camina ' + km(L.m) + ' hasta ' + (L.to ? '<strong>' + esc(G.S[L.to].name) + '</strong>' : 'tu destino') + '</span><span class="mins">' + m(L.min) + '</span></li>';
      var r = G.R[L.route], n = L.stops.length - 1;
      return '<li style="--c:' + r.color + '"><span class="nd"></span><span><span class="rt" style="background:' + r.color + ';color:' + r.text + '">' + esc(r.short) + '</span><strong>' + esc(r.long) + '</strong><br>' +
        'Súbete en <strong>' + esc(G.S[L.from].name) + '</strong> hacia ' + esc(L.headsign) + '<br><small>Espera aprox. ' + m(L.wait) + ' · ' + n + ' paradero' + (n > 1 ? 's' : '') + '</small><br>Bájate en <strong>' + esc(G.S[L.to].name) + '</strong></span><span class="mins">' + m(L.min + L.wait) + '</span></li>';
    }).join('');
    var keys = Object.keys(Agent.MODES), alts = (rec.alts || []).concat([p]).sort(function (a, b) { return keys.indexOf(a.mode) - keys.indexOf(b.mode); });
    var rows = alts.map(function (a) { return '<tr' + (a.mode === md ? ' style="font-weight:700"' : '') + '><td>' + Agent.MODES[a.mode].label + '</td><td class="n">' + m(a.total) + '</td><td class="n">' + a.transfers + '</td><td class="n">' + km(a.walkM) + '</td></tr>'; }).join('');
    var dj = Agent.plan(G, o, d, h, md, { astar: false });
    out.innerHTML = (rec.msg ? '<div class="alert" style="margin-bottom:12px">' + esc(rec.msg) + '</div>' : '') +
      '<div class="ticket"><div class="thead"><div class="tt"><b>' + m(p.total) + '</b><span>entre ' + Math.round(p.range[0]) + ' y ' + Math.round(p.range[1]) + ' min · ' + p.ctx.period + '</span></div>' +
      '<div class="arr">Llegada aprox. <strong>' + fmtH(h + p.total / 60) + '</strong> <small>(entre ' + fmtH(h + p.range[0] / 60) + ' y ' + fmtH(h + p.range[1] / 60) + ')</small></div>' +
      '<div class="kpis"><span>Transbordos <strong>' + p.transfers + '</strong></span><span>Caminata <strong>' + km(p.walkM) + '</strong></span><span>Espera <strong>' + m(p.waitT) + '</strong></span></div></div>' +
      '<ol class="steps"><li class="walk" style="--c:var(--side-mut)"><span class="nd"></span><span>Sales de <strong>' + esc(state.o.label) + '</strong> a las ' + fmtH(h) + '</span><span class="mins"></span></li>' + li +
      '<li><span class="nd" style="border-color:var(--sun);background:var(--sun)"></span><span>Llegas a <strong>' + esc(state.d.label) + '</strong></span><span class="mins"></span></li></ol>' +
      '<div class="share"><button type="button" id="shareBtn">Compartir viaje</button><input id="shareUrl" readonly hidden aria-label="Enlace del viaje"></div>' +
      '<details><summary>Comparar preferencias</summary><table><thead><tr><th>Preferencia</th><th class="n">Tiempo</th><th class="n">Transb.</th><th class="n">Caminata</th></tr></thead><tbody>' + rows + '</tbody></table></details>' +
      '<details><summary>Traza del agente</summary><table><tbody>' +
      '<tr><td>Contexto percibido</td><td class="n">' + p.ctx.period + ', bus a ' + p.ctx.kmh + ' km/h</td></tr>' +
      '<tr><td>Estados expandidos · A*</td><td class="n">' + p.expanded + '</td></tr>' +
      '<tr><td>Estados expandidos · Dijkstra</td><td class="n">' + dj.expanded + '</td></tr>' +
      '<tr><td>¿Mismo costo óptimo?</td><td class="n">' + (Math.abs(dj.cost - p.cost) < 1e-6 ? 'sí' : 'no') + '</td></tr>' +
      '<tr><td>Costo generalizado</td><td class="n">' + p.cost.toFixed(1).replace('.', ',') + '</td></tr>' +
      '<tr><td>Tiempo de cálculo</td><td class="n">' + p.ms.toFixed(2).replace('.', ',') + ' ms</td></tr></tbody></table>' +
      '<p class="expl">El costo generalizado es lo que el agente minimiza: tiempo + penalización por transbordo según tu preferencia.</p></details></div>';
    $('shareBtn').addEventListener('click', share);
  }
  function tripURL() {
    var u = new URL(location.href.split('?')[0].split('#')[0]);
    if (state.o) { u.searchParams.set('o', state.o.ll[0].toFixed(5) + ',' + state.o.ll[1].toFixed(5)); u.searchParams.set('on', state.o.label); }
    if (state.d) { u.searchParams.set('d', state.d.ll[0].toFixed(5) + ',' + state.d.ll[1].toFixed(5)); u.searchParams.set('dn', state.d.label); }
    u.searchParams.set('h', hour()); u.searchParams.set('m', mode()); return u.toString();
  }
  function writeURL() { try { history.replaceState(null, '', tripURL()); } catch (e) {} }
  function share() {
    var url = tripURL(), box = $('shareUrl');
    if (navigator.share) { navigator.share({ title: 'Mi viaje en bus – RutaIbagué', url: url }).catch(function () {}); return; }
    function show() { box.value = url; box.hidden = false; box.select(); }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { $('shareBtn').textContent = 'Enlace copiado'; show(); }, show); else show();
  }
  function readURL() {
    var q = new URLSearchParams(location.search);
    function ll(v) { if (!v) return null; var a = v.split(',').map(Number); return a.length === 2 && isFinite(a[0]) && isFinite(a[1]) ? a : null; }
    var o = ll(q.get('o')), d = ll(q.get('d'));
    if (o) set('o', o, q.get('on') || 'Punto en el mapa'); if (d) set('d', d, q.get('dn') || 'Punto en el mapa');
    if (q.get('h') && isFinite(+q.get('h'))) $('h').value = q.get('h');
    if (q.get('m') && Agent.MODES[q.get('m')]) document.querySelector('input[name=m][value=' + q.get('m') + ']').checked = true;
    return !!(o && d);
  }
  function routesCard() {
    var box = $('rinfo'), sel = map.sel;
    document.querySelectorAll('#lg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.r === sel)); });
    if (!sel) {
      box.innerHTML = '<h2>Rutas</h2><ul class="rlist">' + Object.keys(G.R).map(function (id) { var r = G.R[id];
        return '<li><button type="button" data-r="' + id + '"><span class="rt" style="background:' + r.color + ';color:' + r.text + '">' + esc(r.short) + '</span>' + esc(r.long) + '</button></li>'; }).join('') + '</ul>';
      box.querySelectorAll('button[data-r]').forEach(function (b) { b.addEventListener('click', function () { map.highlight(b.dataset.r); routesCard(); }); });
      return;
    }
    var r = G.R[sel], pat = G.net.patterns.filter(function (p) { return p.route === sel; })[0], hw = Agent.headwayAt(pat, 12);
    box.innerHTML = '<h2><span class="rt" style="background:' + r.color + ';color:' + r.text + '">' + esc(r.short) + '</span>' + esc(r.long) + '</h2><p>Un bus cada <strong>' + Math.round(hw) + ' min</strong> aprox. de día · ' + pat.stops.length + ' paraderos · <button type="button" class="now" id="allR" style="color:var(--ink);border-color:var(--line)">Ver todas</button></p><ol>' +
      pat.stops.map(function (s) { return '<li>' + esc(G.S[s].name) + '</li>'; }).join('') + '</ol>';
    $('allR').addEventListener('click', function () { map.highlight(null); routesCard(); });
  }

  function init(net) {
    G = Agent.build(net);
    $('nStops').textContent = net.stops.length; $('nRoutes').textContent = Object.keys(net.routes).length;
    $('netTitle').textContent = 'Red piloto · ' + Object.keys(net.routes).length + ' rutas · ' + net.stops.length + ' paraderos';
    $('places').innerHTML = net.stops.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); }).map(function (s) { return '<option value="' + esc(s.name) + '">'; }).join('');
    map = new MapView($('map'), {
      tip: $('tip'),
      onClick: function (ll) { var w = state.clicks++ % 2 === 0 ? 'o' : 'd'; set(w, ll, 'Punto en el mapa'); run(); },
      onStop: function (id) { var w = state.clicks++ % 2 === 0 ? 'o' : 'd'; set(w, G.S[id].ll, G.S[id].name); run(); }
    });
    map.setNetwork(G);
    $('lg').innerHTML = Object.keys(G.R).map(function (id) { var r = G.R[id]; return '<button type="button" data-r="' + id + '" style="--rc:' + r.color + '" title="' + esc(r.long) + '" aria-pressed="false">' + esc(r.short) + '</button>'; }).join('');
    $('lg').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { map.highlight(map.sel === b.dataset.r ? null : b.dataset.r); routesCard(); }); });
    routesCard();
    $('zin').addEventListener('click', function () { map.zoomAt(1.5); });
    $('zout').addEventListener('click', function () { map.zoomAt(1 / 1.5); });
    $('zreset').addEventListener('click', function () { map.reset(); });
    $('tilesChk').addEventListener('change', function () { map.setTiles(this.checked); });
    $('h').addEventListener('input', updHour); $('h').addEventListener('change', run);
    $('nowBtn').addEventListener('click', function () { var d = new Date(), h = d.getHours() + Math.round(d.getMinutes() / 15) / 4; $('h').value = Math.min(23.75, Math.max(5, h)); updHour(); run(); });
    document.querySelectorAll('input[name=m]').forEach(function (i) { i.addEventListener('change', run); });
    $('sw').addEventListener('click', function () { var t = state.o; state.o = state.d; state.d = t; $('oq').value = state.o ? state.o.label : ''; $('dq').value = state.d ? state.d.label : ''; run(); });
    ['o', 'd'].forEach(function (w) {
      $(w + 'q').addEventListener('change', function () { resolve(w).then(function (ok) { if (ok) run(); }); });
    });
    $('f').addEventListener('submit', function (e) { e.preventDefault(); Promise.all([resolve('o'), resolve('d')]).then(run); });
    $('locBtn').addEventListener('click', function () {
      if (!navigator.geolocation) { status('Tu navegador no permite usar la ubicación.'); return; }
      status('Buscando tu ubicación…');
      navigator.geolocation.getCurrentPosition(function (pos) { set('o', [pos.coords.latitude, pos.coords.longitude], 'Mi ubicación'); status(''); run(); },
        function () { status('No pude obtener tu ubicación. Revisa el permiso del navegador.'); }, { enableHighAccuracy: true, timeout: 10000 });
    });
    $('helpBtn').addEventListener('click', function () { $('helpDlg').showModal(); });
    $('helpClose').addEventListener('click', function () { $('helpDlg').close(); });
    if (!readURL()) { set('o', G.S.S09 ? G.S.S09.ll : net.stops[0] && [net.stops[0].lat, net.stops[0].lon], G.S.S09 ? G.S.S09.name : net.stops[0].name);
      set('d', G.S.S21 ? G.S.S21.ll : [net.stops[1].lat, net.stops[1].lon], G.S.S21 ? G.S.S21.name : net.stops[1].name); }
    updHour(); run();
  }
  loadNetwork().then(init).catch(function (e) { $('result').innerHTML = '<div class="alert"><strong>Error.</strong> ' + esc(e.message) + '</div>'; });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
