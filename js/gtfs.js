/* GTFS loader: turns a (frequency-based) GTFS feed into the network used by the agent.
   Works in the browser (fetch) and in Node.js (fs). */
(function (root) {
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, i, c;
    text = text.replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return r.length > 1 || r[0] !== ''; });
    var h = rows.shift();
    return rows.map(function (r) { var o = {}; h.forEach(function (k, j) { o[k.trim()] = (r[j] || '').trim(); }); return o; });
  }
  function secs(t) { var p = t.split(':'); return (+p[0]) * 3600 + (+p[1]) * 60 + (+(p[2] || 0)); }
  function build(files) {
    var stops = parseCSV(files['stops.txt']).filter(function (s) { return !s.location_type || s.location_type === '0'; })
      .map(function (s) { return { id: s.stop_id, name: s.stop_name, lat: +s.stop_lat, lon: +s.stop_lon }; });
    var routes = {};
    parseCSV(files['routes.txt']).forEach(function (r) {
      routes[r.route_id] = { id: r.route_id, short: r.route_short_name || r.route_id, long: r.route_long_name || '', color: '#' + (r.route_color || '555555'), text: '#' + (r.route_text_color || 'FFFFFF') };
    });
    var st = {};
    parseCSV(files['stop_times.txt']).forEach(function (x) { (st[x.trip_id] = st[x.trip_id] || []).push(x); });
    var freq = {};
    if (files['frequencies.txt']) parseCSV(files['frequencies.txt']).forEach(function (f) {
      (freq[f.trip_id] = freq[f.trip_id] || []).push({ start: secs(f.start_time) / 3600, end: secs(f.end_time) / 3600, min: +f.headway_secs / 60 });
    });
    // one pattern per distinct (route, direction, stop sequence); keep the first trip of each
    var seen = {}, patterns = [];
    parseCSV(files['trips.txt']).forEach(function (t) {
      var times = (st[t.trip_id] || []).sort(function (a, b) { return +a.stop_sequence - +b.stop_sequence; });
      if (times.length < 2) return;
      var seq = times.map(function (x) { return x.stop_id; }), key = t.route_id + '|' + seq.join('>');
      if (seen[key]) return; seen[key] = 1;
      patterns.push({ id: t.trip_id, route: t.route_id, dir: +(t.direction_id || 0), headsign: t.trip_headsign || '', stops: seq, headways: freq[t.trip_id] || [] });
    });
    return { stops: stops, routes: routes, patterns: patterns };
  }
  var FILES = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'frequencies.txt'];
  function load(base) {
    return Promise.all(FILES.map(function (f) {
      return fetch(base + f).then(function (r) { if (!r.ok) throw new Error('No se pudo leer ' + f); return r.text(); });
    })).then(function (txt) { var o = {}; FILES.forEach(function (f, i) { o[f] = txt[i]; }); return build(o); });
  }
  function loadNode(dir) {
    var fs = require('fs'), path = require('path'), o = {};
    FILES.forEach(function (f) { var p = path.join(dir, f); if (fs.existsSync(p)) o[f] = fs.readFileSync(p, 'utf8'); });
    return build(o);
  }
  var API = { parseCSV: parseCSV, build: build, load: load, loadNode: loadNode };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.GTFS = API;
})(this);
