/* Lightweight SVG map: Web-Mercator projection, OpenStreetMap tiles, pan and zoom.
   No external library, so the app also works offline (without the street tiles). */
(function (root) {
  var NS = 'http://www.w3.org/2000/svg', Z = 14, TS = 256;
  function px(ll) {
    var s = TS * Math.pow(2, Z), lat = ll[0] * Math.PI / 180;
    return [(ll[1] + 180) / 360 * s, (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * s];
  }
  function unpx(x, y) {
    var s = TS * Math.pow(2, Z), lon = x / s * 360 - 180, n = Math.PI - 2 * Math.PI * y / s;
    return [180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lon];
  }
  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }

  function MapView(svg, opt) {
    this.svg = svg; this.opt = opt; this.tilesOn = true; this.tileEls = {};
    this.gT = el('g', { 'class': 'tiles' }, svg); this.gR = el('g', {}, svg); this.gP = el('g', {}, svg);
    this.gS = el('g', {}, svg); this.gL = el('g', {}, svg); this.gM = el('g', {}, svg);
    this.plan = null; this.sel = null; this.ends = {};
    this._events();
  }
  MapView.prototype.setNetwork = function (G) {
    this.G = G;
    var xs = [], ys = [];
    for (var s in G.S) { var p = px(G.S[s].ll); xs.push(p[0]); ys.push(p[1]); }
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
    var padX = (x1 - x0) * 0.06, padY = (y1 - y0) * 0.12; x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    var w = x1 - x0, h = y1 - y0, ar = (this.svg.clientWidth && this.svg.clientHeight) ? this.svg.clientWidth / this.svg.clientHeight : 16 / 9;
    if (w / h > ar) { var nh = w / ar; y0 -= (nh - h) / 2; h = nh; } else { var nw = h * ar; x0 -= (nw - w) / 2; w = nw; }
    this.home = { x: x0, y: y0, w: w, h: h }; this.vb = Object.assign({}, this.home);
    // one drawn line per route (first pattern of each route)
    this.lines = []; var seen = {};
    G.net.patterns.forEach(function (p) { if (!seen[p.route]) { seen[p.route] = 1; this.lines.push(p); } }, this);
    this.redraw();
  };
  MapView.prototype.k = function () { return this.vb.w / (this.svg.clientWidth || 900); };
  MapView.prototype.zoomFactor = function () { return this.home.w / this.vb.w; };
  MapView.prototype.apply = function () { var v = this.vb; this.svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h); };
  MapView.prototype.zoomAt = function (f, cx, cy) {
    var v = this.vb, zf = this.zoomFactor() * f;
    if (zf < 1) f = 1 / this.zoomFactor(); if (zf > 8) f = 8 / this.zoomFactor();
    if (cx === undefined) { cx = v.x + v.w / 2; cy = v.y + v.h / 2; }
    v.x = cx - (cx - v.x) / f; v.y = cy - (cy - v.y) / f; v.w /= f; v.h /= f; this.clamp(); this.redraw();
  };
  MapView.prototype.clamp = function () {
    var v = this.vb, H = this.home;
    v.x = Math.min(Math.max(v.x, H.x - v.w * 0.25), H.x + H.w - v.w * 0.75);
    v.y = Math.min(Math.max(v.y, H.y - v.h * 0.25), H.y + H.h - v.h * 0.75);
  };
  MapView.prototype.reset = function () { this.vb = Object.assign({}, this.home); this.redraw(); };
  MapView.prototype.setTiles = function (on) { this.tilesOn = on; this.redraw(); };
  MapView.prototype.toLL = function (clientX, clientY) {
    var r = this.svg.getBoundingClientRect(), v = this.vb;
    return unpx(v.x + (clientX - r.left) / r.width * v.w, v.y + (clientY - r.top) / r.height * v.h);
  };
  MapView.prototype.drawTiles = function () {
    var v = this.vb, keep = {}, self = this;
    if (this.tilesOn) {
      var zf = this.zoomFactor(), zl = Z + (zf >= 1.8 ? 1 : 0) + (zf >= 3.6 ? 1 : 0), sc = Math.pow(2, zl - Z), ts = TS / sc;
      for (var tx = Math.floor(v.x / ts); tx <= Math.floor((v.x + v.w) / ts); tx++)
        for (var ty = Math.floor(v.y / ts); ty <= Math.floor((v.y + v.h) / ts); ty++) {
          var key = zl + '/' + tx + '/' + ty; keep[key] = 1;
          if (!this.tileEls[key]) {
            var im = el('image', { x: tx * ts, y: ty * ts, width: ts + 0.5, height: ts + 0.5, preserveAspectRatio: 'none' }, this.gT);
            im.setAttribute('href', 'https://tile.openstreetmap.org/' + key + '.png');
            im.addEventListener('error', function () { this.remove(); });
            this.tileEls[key] = im;
          }
        }
    }
    Object.keys(this.tileEls).forEach(function (key) { if (!keep[key]) { self.tileEls[key].remove(); delete self.tileEls[key]; } });
  };
  MapView.prototype.redraw = function () {
    if (!this.G) return;
    this.apply(); this.drawTiles();
    var G = this.G, k = this.k(), self = this;
    this.gR.innerHTML = ''; this.gS.innerHTML = ''; this.gP.innerHTML = ''; this.gL.innerHTML = ''; this.gM.innerHTML = '';
    this.lines.forEach(function (p, i) {
      var r = G.R[p.route], off = (i % 4 - 1.5) * 1.8 * k, on = self.sel === p.route;
      var pts = p.stops.map(function (s) { var q = px(G.S[s].ll); return (q[0] + off) + ',' + (q[1] + off); }).join(' ');
      var op = self.sel ? (on ? 1 : 0.12) : (self.plan ? 0.2 : 0.9);
      el('polyline', { points: pts, fill: 'none', stroke: '#ffffff', 'stroke-width': (on ? 10 : 7.5) * k, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: op * 0.8 }, self.gR);
      el('polyline', { points: pts, fill: 'none', stroke: r.color, 'stroke-width': (on ? 7 : 4.5) * k, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: op }, self.gR);
    });
    if (this.plan) {
      var cur = this.ends.o, P = this.plan;
      P.legs.forEach(function (L) {
        if (L.type === 'walk') {
          var to = L.to ? G.S[L.to].ll : self.ends.d, a = px(cur), b = px(to);
          if (L.m > 5) el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'var(--ink)', 'stroke-width': 3 * k, 'stroke-dasharray': (2 * k) + ' ' + (6 * k), 'stroke-linecap': 'round' }, self.gP);
          cur = to;
        } else {
          var r = G.R[L.route];
          var lp = L.stops.map(function (s) { return px(G.S[s].ll).join(','); }).join(' ');
          el('polyline', { points: lp, fill: 'none', stroke: '#ffffff', 'stroke-width': 13 * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: self.sel ? 0.25 : 1 }, self.gP);
          el('polyline', { points: lp, fill: 'none', stroke: r.color, 'stroke-width': 9 * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: self.sel ? 0.25 : 1 }, self.gP);
          [L.from, L.to].forEach(function (s) { var q = px(G.S[s].ll); var t = el('text', { x: q[0] + 10 * k, y: q[1] - 10 * k, 'class': 'lbl', 'font-size': 12.5 * k, 'stroke-width': 4 * k }, self.gL); t.textContent = G.S[s].name; });
          cur = G.S[L.to].ll;
        }
      });
    }
    var tip = this.opt.tip;
    Object.keys(G.S).forEach(function (id) {
      var q = px(G.S[id].ll), c = el('circle', { cx: q[0], cy: q[1], r: 6 * k, 'stroke-width': 1.8 * k, 'class': 'stopc', tabindex: 0, role: 'button', 'aria-label': G.S[id].name }, self.gS);
      c.addEventListener('mouseenter', function () { if (!tip) return; var m = self.svg.parentNode.getBoundingClientRect(), r = c.getBoundingClientRect(); tip.textContent = G.S[id].name; tip.hidden = false; tip.style.left = (r.left - m.left + 12) + 'px'; tip.style.top = (r.top - m.top - 28) + 'px'; });
      c.addEventListener('mouseleave', function () { if (tip) tip.hidden = true; });
      c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); self.opt.onStop(id); } });
      c._stop = id;
    });
    [['o', 'A'], ['d', 'B']].forEach(function (q) {
      var ll = self.ends[q[0]]; if (!ll) return; var p = px(ll);
      el('circle', { cx: p[0], cy: p[1], r: 13 * k, fill: q[0] === 'o' ? 'var(--side)' : 'var(--sun)', stroke: '#ffffff', 'stroke-width': 2.5 * k }, self.gM);
      var t = el('text', { x: p[0], y: p[1] + 4.6 * k, 'text-anchor': 'middle', 'font-size': 13 * k, 'font-weight': 700, fill: q[0] === 'o' ? '#ffffff' : '#1a1400', 'font-family': 'var(--f-mono)' }, self.gM); t.textContent = q[1];
    });
  };
  MapView.prototype.setEnds = function (o, d) { this.ends = { o: o, d: d }; };
  MapView.prototype.setPlan = function (p) { this.plan = p; this.redraw(); };
  MapView.prototype.highlight = function (rid) { this.sel = rid; this.redraw(); };
  MapView.prototype._events = function () {
    var self = this, svg = this.svg, down = null, pointers = {};
    svg.addEventListener('pointerdown', function (ev) {
      pointers[ev.pointerId] = [ev.clientX, ev.clientY];
      down = { x: ev.clientX, y: ev.clientY, vb: Object.assign({}, self.vb), moved: false, target: ev.target, n: Object.keys(pointers).length };
      if (down.n === 2) { var a = Object.values(pointers); down.dist = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); }
      svg.setPointerCapture(ev.pointerId);
    });
    svg.addEventListener('pointermove', function (ev) {
      if (!down) return; pointers[ev.pointerId] = [ev.clientX, ev.clientY];
      var r = svg.getBoundingClientRect(), a = Object.values(pointers);
      if (a.length === 2 && down.dist) { // pinch
        var d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (Math.abs(d - down.dist) > 8) { var f = d / down.dist; down.dist = d; down.moved = true;
          var cx = (a[0][0] + a[1][0]) / 2, cy = (a[0][1] + a[1][1]) / 2, v = self.vb; self.zoomAt(f, v.x + (cx - r.left) / r.width * v.w, v.y + (cy - r.top) / r.height * v.h); }
        return;
      }
      var dx = ev.clientX - down.x, dy = ev.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) < 5) return;
      down.moved = true; svg.classList.add('dragging');
      self.vb.x = down.vb.x - dx / r.width * down.vb.w; self.vb.y = down.vb.y - dy / r.height * down.vb.h; self.clamp(); self.redraw();
    });
    function end(ev) {
      delete pointers[ev.pointerId];
      if (!down) return; svg.classList.remove('dragging');
      if (!down.moved && down.n === 1) {
        var t = document.elementFromPoint(ev.clientX, ev.clientY);
        if (t && t._stop) self.opt.onStop(t._stop); else self.opt.onClick(self.toLL(ev.clientX, ev.clientY));
      }
      if (!Object.keys(pointers).length) down = null;
    }
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', function (ev) { delete pointers[ev.pointerId]; down = null; svg.classList.remove('dragging'); });
    svg.addEventListener('wheel', function (ev) {
      ev.preventDefault(); var r = svg.getBoundingClientRect(), v = self.vb;
      self.zoomAt(ev.deltaY < 0 ? 1.25 : 0.8, v.x + (ev.clientX - r.left) / r.width * v.w, v.y + (ev.clientY - r.top) / r.height * v.h);
    }, { passive: false });
    window.addEventListener('resize', function () { self.redraw(); });
  };
  root.MapView = MapView; root.MapView.px = px; root.MapView.unpx = unpx;
})(this);
