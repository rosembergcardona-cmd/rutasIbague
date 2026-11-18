// Builds the GTFS feed in data/gtfs/ from the pilot network definition.
// The pilot network is SAMPLE data: stop positions are approximate and the
// routes are illustrative, not the official routes of Ibagué's bus companies.
const fs = require('fs'), path = require('path');
const NET = require('./pilot_network.js');
const OUT = path.join(__dirname, '..', 'data', 'gtfs');
const OFFPEAK_KMH = 19, DETOUR = 1.35, DWELL_S = 24;
const hav = (a, b) => { const R = 6371000, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const S = {}; NET.stops.forEach(s => S[s[0]] = [s[2], s[3]]);
const hms = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return [h, m, x].map(v => String(v).padStart(2, '0')).join(':'); };
const csv = (rows) => rows.map(r => r.map(v => { v = String(v); return /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n') + '\n';
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'agency.txt'), csv([['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang'],
  ['PILOT', 'Red piloto RutaIbagué (datos de muestra)', 'https://github.com/', 'America/Bogota', 'es']]));
fs.writeFileSync(path.join(OUT, 'feed_info.txt'), csv([['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_version'],
  ['RutaIbagué – Universidad de Ibagué (proyecto académico)', 'https://github.com/', 'es', 'pilot-1.0']]));
fs.writeFileSync(path.join(OUT, 'calendar.txt'), csv([['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
  ['DIARIO', 1, 1, 1, 1, 1, 1, 1, '20260101', '20271231']]));
fs.writeFileSync(path.join(OUT, 'stops.txt'), csv([['stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'location_type'],
  ...NET.stops.map(s => [s[0], s[1], s[2].toFixed(5), s[3].toFixed(5), 0])]));
fs.writeFileSync(path.join(OUT, 'routes.txt'), csv([['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color', 'route_text_color'],
  ...NET.routes.map(r => [r.id, 'PILOT', r.id, r.name.replace(/^Ruta \d+ · /, ''), 3, r.color.slice(1).toUpperCase(), 'FFFFFF'])]));
const trips = [['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id']], st = [['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence']],
  fr = [['trip_id', 'start_time', 'end_time', 'headway_secs', 'exact_times']];
NET.routes.forEach(r => {
  [0, 1].forEach(dir => {
    const seq = dir ? r.stops.slice().reverse() : r.stops, tid = r.id + '_' + dir;
    trips.push([r.id, 'DIARIO', tid, NET.stops.find(s => s[0] === seq[seq.length - 1])[1], dir]);
    let t = 0; seq.forEach((s, i) => { if (i) t += hav(S[seq[i - 1]], S[s]) * DETOUR / 1000 / OFFPEAK_KMH * 3600 + DWELL_S; st.push([tid, hms(t), hms(t), s, i + 1]); });
    // service 05:00-21:00 at the daytime headway, 21:00-24:00 at double headway
    fr.push([tid, '05:00:00', '21:00:00', r.headway * 60, 0]);
    fr.push([tid, '21:00:00', '24:00:00', r.headway * 120, 0]);
  });
});
fs.writeFileSync(path.join(OUT, 'trips.txt'), csv(trips));
fs.writeFileSync(path.join(OUT, 'stop_times.txt'), csv(st));
fs.writeFileSync(path.join(OUT, 'frequencies.txt'), csv(fr));
console.log('GTFS written to', OUT, 'stops', NET.stops.length, 'routes', NET.routes.length, 'trips', trips.length - 1, 'stop_times', st.length - 1);
