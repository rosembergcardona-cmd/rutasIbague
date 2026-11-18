// Experiments reported in the paper. Output: experiments/results.json
const fs = require('fs'), path = require('path');
const GTFS = require('../js/gtfs.js'), A = require('../js/agent.js');
const net = GTFS.loadNode(path.join(__dirname, '..', 'data', 'gtfs')), G = A.build(net);
const ids = Object.keys(G.S), ll = id => G.S[id].ll, pairs = [];
for (const o of ids) for (const d of ids) if (o !== d) pairs.push([o, d]);
let seed = 42; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const out = { network: { stops: ids.length, routes: Object.keys(net.routes).length, patterns: net.patterns.length, pairs: pairs.length } };

// E1: optimality and efficiency of A* vs Dijkstra, by period
const hours = { peak: 7, offpeak: 15, night: 22 }; out.e1 = {};
for (const [k, h] of Object.entries(hours)) {
  let eq = 0; const ea = [], ed = [], ta = [], td = [], tot = [];
  for (const [o, d] of pairs) {
    const a = A.plan(G, ll(o), ll(d), h, 'fastest'), b = A.plan(G, ll(o), ll(d), h, 'fastest', { astar: false });
    if (Math.abs(a.cost - b.cost) < 1e-6) eq++; ea.push(a.expanded); ed.push(b.expanded); ta.push(a.ms); td.push(b.ms); tot.push(a.total);
  }
  out.e1[k] = { optimalPct: 100 * eq / pairs.length, expA: mean(ea), expD: mean(ed), reductionPct: 100 * (1 - mean(ea) / mean(ed)),
    msA: mean(ta), msD: mean(td), msA95: pct(ta, 0.95), meanTripMin: mean(tot) };
}
// E2: coverage of a direct-route-only baseline vs the agent (off-peak)
{
  let direct = 0, improved = 0; const gains = [], transfers = [];
  for (const [o, d] of pairs) {
    const ag = A.plan(G, ll(o), ll(d), 15, 'fastest'); transfers.push(ag.transfers);
    const pats = net.patterns.filter(p => { const i = p.stops.indexOf(o), j = p.stops.indexOf(d); return i >= 0 && j > i; });
    if (!pats.length) continue; direct++;
    const p = pats[0], ctx = A.context(15), i = p.stops.indexOf(o), j = p.stops.indexOf(d);
    let t = A.headwayAt(p, 15) / 2;
    for (let s = i; s < j; s++) t += A.hav(ll(p.stops[s]), ll(p.stops[s + 1])) * A.P.detour / 1000 / ctx.kmh * 60 + A.P.dwellMin;
    gains.push(t - ag.total); if (t - ag.total > 0.5) improved++;
  }
  out.e2 = { directCoveragePct: 100 * direct / pairs.length, agentCoveragePct: 100, improvedPctWhenDirect: 100 * improved / direct,
    meanGainMinWhenDirect: mean(gains), maxGainMinWhenDirect: Math.max(...gains),
    transferDist: [0, 1, 2, 3].map(n => 100 * transfers.filter(x => x === n).length / transfers.length) };
}
// E3: 500 synthetic trips with ends up to 1.2 km from random stops; decisions and preference trade-offs
{
  const jit = () => { const s = ll(ids[Math.floor(rnd() * ids.length)]), r = rnd() * 1200, a = rnd() * 2 * Math.PI;
    return [s[0] + r * Math.cos(a) / 111320, s[1] + r * Math.sin(a) / (111320 * Math.cos(s[0] * Math.PI / 180))]; };
  const trips = []; for (let i = 0; i < 500; i++) trips.push([jit(), jit()]);
  const e3 = { n: 500, bus: 0, walk: 0, abstain: 0, modes: {} };
  for (const m of Object.keys(A.MODES)) e3.modes[m] = { total: [], transfers: [], walkM: [] };
  for (const [o, d] of trips) {
    const r = A.recommend(G, o, d, 15, 'fastest'); e3[r.decision]++;
    if (r.decision !== 'bus') continue;
    for (const m of Object.keys(A.MODES)) { const p = A.plan(G, o, d, 15, m); e3.modes[m].total.push(p.total); e3.modes[m].transfers.push(p.transfers); e3.modes[m].walkM.push(p.walkM); }
  }
  for (const m of Object.keys(e3.modes)) { const s = e3.modes[m]; e3.modes[m] = { n: s.total.length, total: mean(s.total), transfers: mean(s.transfers), walkM: mean(s.walkM) }; }
  out.e3 = e3;
}
// E4: effect of the time of day on the recommended trip (all pairs)
{
  out.e4 = {};
  for (const h of [6, 7, 9, 12, 15, 18, 20, 22]) {
    const t = [], w = [], rng = [];
    for (const [o, d] of pairs) { const p = A.plan(G, ll(o), ll(d), h, 'fastest'); t.push(p.total); w.push(p.waitT); rng.push(p.range[1] - p.range[0]); }
    out.e4[h] = { period: A.context(h).key, meanTotal: mean(t), meanWait: mean(w), meanRangeWidth: mean(rng) };
  }
}
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
