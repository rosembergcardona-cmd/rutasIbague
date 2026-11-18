/* RutaIbagué agent: perceives the trip request and its context, searches the
   stop–route state graph with A*, and decides with a utility (generalized cost).
   Runs unchanged in the browser and in Node.js (tests and experiments). */
(function (root) {
  var P = { detour: 1.35, walkDetour: 1.25, walkKmh: 4.5, maxAccessM: 800, maxTransferM: 350, dwellMin: 0.4, walkOnlyM: 450 };
  var MODES = {
    fastest:   { label: 'Más rápida',        transferPen: 3,  walkW: 1.0 },
    transfers: { label: 'Menos transbordos', transferPen: 12, walkW: 1.0 },
    walking:   { label: 'Menos caminata',    transferPen: 3,  walkW: 2.5 }
  };
  function hav(a, b) {
    var R = 6371000, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t;
    var h = Math.pow(Math.sin(dl / 2), 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.pow(Math.sin(dn / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  /* Perception of context: hour of day -> period, assumed bus speed and travel-time variability.
     Speeds are ASSUMPTIONS to be calibrated with measured trips. */
  function context(hour) {
    var peak = (hour >= 6 && hour < 8.5) || (hour >= 11.5 && hour < 14) || (hour >= 17 && hour < 19.5);
    var night = hour >= 21 || hour < 5;
    if (night) return { period: 'noche', key: 'night', kmh: 22, variability: 0.25 };
    if (peak) return { period: 'hora pico', key: 'peak', kmh: 13, variability: 0.35 };
    return { period: 'hora valle', key: 'offpeak', kmh: 19, variability: 0.20 };
  }
  function headwayAt(pat, hour) {
    for (var i = 0; i < pat.headways.length; i++) { var h = pat.headways[i]; if (hour >= h.start && hour < h.end) return h.min; }
    return pat.headways.length ? null : 15; // null = no service at that hour
  }
  function walkMin(m) { return m * P.walkDetour / 1000 / P.walkKmh * 60; }
  function build(net) {
    var S = {}, R = net.routes, PT = {};
    net.stops.forEach(function (s) { S[s.id] = { id: s.id, name: s.name, ll: [s.lat, s.lon] }; });
    net.patterns.forEach(function (p) { PT[p.id] = p; });
    var near = {};
    net.stops.forEach(function (a) {
      near[a.id] = [];
      net.stops.forEach(function (b) { if (a.id !== b.id) { var d = hav(S[a.id].ll, S[b.id].ll); if (d <= P.maxTransferM) near[a.id].push([b.id, d]); } });
    });
    var serve = {};
    net.patterns.forEach(function (p) { p.stops.forEach(function (s, i) { if (i < p.stops.length - 1) (serve[s] = serve[s] || []).push([p.id, i]); }); });
    return { S: S, R: R, PT: PT, near: near, serve: serve, net: net };
  }
  function Heap() { this.a = []; }
  Heap.prototype.push = function (x) { var a = this.a, i = a.length; a.push(x); while (i > 0) { var p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; var t = a[p]; a[p] = a[i]; a[i] = t; i = p; } };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], l = a.pop();
    if (a.length) { a[0] = l; var i = 0; for (;;) { var L = 2 * i + 1, Rr = L + 1, m = i;
      if (L < a.length && a[L].f < a[m].f) m = L; if (Rr < a.length && a[Rr].f < a[m].f) m = Rr; if (m === i) break; var t = a[m]; a[m] = a[i]; a[i] = t; i = m; } }
    return top;
  };
  /* State space:
     "O" origin, "D" destination,
     "w0|S" at stop S before the first boarding, "w|S" at stop S after alighting,
     "b|P|i" on board pattern P at its i-th stop. */
  function plan(G, orig, dest, hour, mode, opts) {
    opts = opts || {};
    var useA = opts.astar !== false, ctx = context(hour), M = MODES[mode] || MODES.fastest;
    var vmax = Math.max(ctx.kmh, P.walkKmh) * 1000 / 60; // metres per minute: admissible bound
    function h(ll) { return useA ? hav(ll, dest) / vmax : 0; }
    function pos(k) {
      if (k === 'O') return orig; if (k === 'D') return dest; var p = k.split('|');
      if (p[0] === 'b') return G.S[G.PT[p[1]].stops[+p[2]]].ll; return G.S[p[1]].ll;
    }
    function neigh(k) {
      var out = [], p = k.split('|');
      if (k === 'O') {
        var dd = hav(orig, dest); out.push(['D', walkMin(dd) * M.walkW, { t: 'walk', m: dd, min: walkMin(dd) }]);
        for (var s in G.S) { var d = hav(orig, G.S[s].ll); if (d <= P.maxAccessM) out.push(['w0|' + s, walkMin(d) * M.walkW, { t: 'walk', m: d, min: walkMin(d), to: s }]); }
        return out;
      }
      if (p[0] === 'w0' || p[0] === 'w') {
        var st = p[1], first = p[0] === 'w0';
        (G.serve[st] || []).forEach(function (pi) {
          var pat = G.PT[pi[0]], hw = headwayAt(pat, hour); if (hw === null) return;
          var wait = hw / 2;
          out.push(['b|' + pat.id + '|' + pi[1], wait + (first ? 0 : M.transferPen), { t: 'board', pat: pat.id, at: st, min: wait, transfer: !first }]);
        });
        if (!first) G.near[st].forEach(function (n) { out.push(['w|' + n[0], walkMin(n[1]) * M.walkW, { t: 'walk', m: n[1], min: walkMin(n[1]), to: n[0] }]); });
        var dd2 = hav(G.S[st].ll, dest);
        if (dd2 <= P.maxAccessM && !first) out.push(['D', walkMin(dd2) * M.walkW, { t: 'walk', m: dd2, min: walkMin(dd2) }]);
        return out;
      }
      if (p[0] === 'b') {
        var pat2 = G.PT[p[1]], i = +p[2], j = i + 1;
        if (j < pat2.stops.length) {
          var dm = hav(G.S[pat2.stops[i]].ll, G.S[pat2.stops[j]].ll), mm = dm * P.detour / 1000 / ctx.kmh * 60 + P.dwellMin;
          out.push(['b|' + pat2.id + '|' + j, mm, { t: 'ride', pat: pat2.id, from: pat2.stops[i], to: pat2.stops[j], min: mm, m: dm }]);
        }
        if (i > 0) out.push(['w|' + pat2.stops[i], 0, { t: 'alight', pat: pat2.id, at: pat2.stops[i], min: 0 }]);
        return out;
      }
      return out;
    }
    var now = (typeof performance !== 'undefined' ? performance : Date);
    var t0 = now.now(), g = { O: 0 }, prev = {}, closed = {}, heap = new Heap(), expanded = 0;
    heap.push({ k: 'O', f: h(orig) });
    while (heap.a.length) {
      var cur = heap.pop(); if (closed[cur.k]) continue; closed[cur.k] = 1; expanded++;
      if (cur.k === 'D') break;
      neigh(cur.k).forEach(function (e) {
        var ng = g[cur.k] + e[1];
        if (g[e[0]] === undefined || ng < g[e[0]] - 1e-9) { g[e[0]] = ng; prev[e[0]] = [cur.k, e[2]]; heap.push({ k: e[0], f: ng + h(pos(e[0])) }); }
      });
    }
    var ms = now.now() - t0;
    if (g.D === undefined) return { ok: false, expanded: expanded, ms: ms, ctx: ctx, mode: mode };
    var path = [], k = 'D'; while (k !== 'O') { path.unshift(prev[k][1]); k = prev[k][0]; }
    var legs = [], walkM = 0, walkT = 0, rideT = 0, waitT = 0, boards = 0;
    path.forEach(function (e) {
      var L = legs[legs.length - 1];
      if (e.t === 'walk') { walkM += e.m; walkT += e.min; if (L && L.type === 'walk') { L.m += e.m; L.min += e.min; if (e.to) L.to = e.to; } else legs.push({ type: 'walk', m: e.m, min: e.min, to: e.to }); }
      else if (e.t === 'board') { boards++; waitT += e.min; var pt = G.PT[e.pat]; legs.push({ type: 'bus', pat: e.pat, route: pt.route, headsign: pt.headsign, from: e.at, to: e.at, stops: [e.at], wait: e.min, min: 0, m: 0 }); }
      else if (e.t === 'ride') { L.to = e.to; L.stops.push(e.to); L.min += e.min; L.m += e.m; rideT += e.min; }
    });
    var total = walkT + waitT + rideT;
    return { ok: true, cost: g.D, total: total, walkM: walkM, walkT: walkT, waitT: waitT, rideT: rideT,
      transfers: Math.max(0, boards - 1), boards: boards, legs: legs, expanded: expanded, ms: ms, ctx: ctx, mode: mode,
      range: [total - rideT * ctx.variability * 0.5 - waitT * 0.5, total + rideT * ctx.variability + waitT * 0.6] };
  }
  function nearest(G, ll) { var b = null; for (var s in G.S) { var d = hav(ll, G.S[s].ll); if (!b || d < b.d) b = { id: s, d: d }; } return b; }
  /* Decision with abstention: the agent only recommends a bus when its data cover the trip. */
  function recommend(G, orig, dest, hour, mode) {
    var nO = nearest(G, orig), nD = nearest(G, dest), direct = hav(orig, dest);
    if (direct < P.walkOnlyM) return { decision: 'walk', msg: 'El destino está a solo ' + Math.round(direct) + ' m. Lo mejor es caminar.', plan: plan(G, orig, dest, hour, mode) };
    var farO = nO.d > P.maxAccessM, farD = nD.d > P.maxAccessM;
    if (farO || farD) {
      var f = farO ? nO : nD;
      return { decision: 'abstain', plan: null, msg: 'No hay ningún paradero de la red a menos de ' + P.maxAccessM + ' m del ' + (farO ? 'origen' : 'destino') +
        ' (el más cercano es ' + G.S[f.id].name + ', a ' + Math.round(f.d) + ' m). El agente no tiene datos suficientes para recomendar un bus aquí.' };
    }
    var p = plan(G, orig, dest, hour, mode);
    if (!p.ok) return { decision: 'abstain', plan: p, msg: 'No hay servicio de buses a esa hora o no se encontró ninguna conexión en la red.' };
    var alts = Object.keys(MODES).filter(function (m) { return m !== mode; }).map(function (m) { return plan(G, orig, dest, hour, m); });
    return { decision: p.boards ? 'bus' : 'walk', msg: p.boards ? '' : 'Caminar es más rápido que cualquier bus para este viaje.', plan: p, alts: alts };
  }
  var API = { build: build, plan: plan, recommend: recommend, context: context, headwayAt: headwayAt, nearest: nearest, hav: hav, walkMin: walkMin, MODES: MODES, P: P };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Agent = API;
})(this);
