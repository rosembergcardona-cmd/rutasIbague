// Unit tests for the RutaIbagué agent. Run with: npm test  (Node.js 18+, no dependencies)
const test = require('node:test'), assert = require('node:assert');
const path = require('path');
const GTFS = require('../js/gtfs.js'), A = require('../js/agent.js');
const net = GTFS.loadNode(path.join(__dirname, '..', 'data', 'gtfs'));
const G = A.build(net), ids = Object.keys(G.S), ll = id => G.S[id].ll;

test('GTFS feed loads the pilot network', () => {
  assert.strictEqual(net.stops.length, 28);
  assert.strictEqual(Object.keys(net.routes).length, 8);
  assert.strictEqual(net.patterns.length, 16); // one pattern per route and direction
});

test('context perception classifies the hour of day', () => {
  assert.strictEqual(A.context(7).key, 'peak');
  assert.strictEqual(A.context(15).key, 'offpeak');
  assert.strictEqual(A.context(22).key, 'night');
});

test('A* returns the same optimal cost as Dijkstra for every stop pair', () => {
  for (const h of [7, 15, 22]) for (const o of ids) for (const d of ids) {
    if (o === d) continue;
    const a = A.plan(G, ll(o), ll(d), h, 'fastest'), b = A.plan(G, ll(o), ll(d), h, 'fastest', { astar: false });
    assert.ok(Math.abs(a.cost - b.cost) < 1e-6, `${o}->${d} at ${h}h`);
    assert.ok(a.expanded <= b.expanded, 'A* should not expand more states than Dijkstra');
  }
});

test('the heuristic never overestimates the optimal cost (admissibility)', () => {
  for (const h of [7, 15]) for (const o of ids) for (const d of ids) {
    if (o === d) continue;
    const ctx = A.context(h), vmax = Math.max(ctx.kmh, A.P.walkKmh) * 1000 / 60;
    const p = A.plan(G, ll(o), ll(d), h, 'fastest', { astar: false });
    assert.ok(A.hav(ll(o), ll(d)) / vmax <= p.cost + 1e-9);
  }
});

test('a higher transfer penalty never increases the number of transfers', () => {
  for (const o of ids) for (const d of ids) {
    if (o === d) continue;
    const f = A.plan(G, ll(o), ll(d), 15, 'fastest'), t = A.plan(G, ll(o), ll(d), 15, 'transfers');
    assert.ok(t.transfers <= f.transfers, `${o}->${d}`);
  }
});

test('a higher walking weight never increases the walking distance', () => {
  for (const o of ids) for (const d of ids) {
    if (o === d) continue;
    const f = A.plan(G, ll(o), ll(d), 15, 'fastest'), w = A.plan(G, ll(o), ll(d), 15, 'walking');
    assert.ok(w.walkM <= f.walkM + 1e-6, `${o}->${d}`);
  }
});

test('the agent abstains when no stop is within 800 m', () => {
  const r = A.recommend(G, [4.50, -75.10], ll('S01'), 8, 'fastest');
  assert.strictEqual(r.decision, 'abstain');
  assert.match(r.msg, /800 m/);
});

test('the agent recommends walking for very short trips', () => {
  const r = A.recommend(G, ll('S01'), [ll('S01')[0] + 0.002, ll('S01')[1]], 8, 'fastest');
  assert.strictEqual(r.decision, 'walk');
});

test('no bus is recommended outside service hours', () => {
  const r = A.recommend(G, ll('S09'), ll('S21'), 4, 'fastest');
  assert.notStrictEqual(r.decision, 'bus');
});

test('the time range contains the point estimate', () => {
  const p = A.plan(G, ll('S09'), ll('S21'), 7.5, 'fastest');
  assert.ok(p.range[0] < p.total && p.total < p.range[1]);
});

test('every bus leg follows the stop order of its pattern', () => {
  const p = A.plan(G, ll('S04'), ll('S25'), 10, 'fastest');
  for (const L of p.legs.filter(l => l.type === 'bus')) {
    const seq = G.PT[L.pat].stops, i = seq.indexOf(L.from), j = seq.indexOf(L.to);
    assert.ok(i >= 0 && j > i);
  }
});
