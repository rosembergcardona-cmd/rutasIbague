"""Figures for the paper (docs/figures/). Run after run_experiments.js."""
import json, csv, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from matplotlib.patches import FancyBboxPatch
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "figures"); os.makedirs(OUT, exist_ok=True)
R = json.load(open(os.path.join(ROOT, "experiments", "results.json")))
C1, C2, C3, INK, MUTED, GRID = "#3A6EA5", "#C8742B", "#2A9D8F", "#222222", "#666666", "#E6E6E6"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": "#999999", "axes.labelcolor": INK,
                     "xtick.color": MUTED, "ytick.color": MUTED, "axes.spines.top": False, "axes.spines.right": False})

def save(fig, name):
    fig.savefig(os.path.join(OUT, name), dpi=220, bbox_inches="tight"); plt.close(fig)

# Fig. 1: agent architecture
fig, ax = plt.subplots(figsize=(8, 3.1)); ax.set_xlim(0, 100); ax.set_ylim(0, 40); ax.axis("off")
N = "#1F3A5F"
boxes = [(1, 13, 17, 11, "User request\n(origin, destination,\ntime, preference)", "#E3ECF5"),
         (22, 13, 17, 11, "Perception\n(nearest stops,\ntime-of-day context)", "#E3ECF5"),
         (43, 13, 17, 11, "A* search\n(stop–route\nstate graph)", "#FBE9D7"),
         (64, 13, 16, 11, "Decision\n(utility; abstain\nif no data)", "#FBE9D7"),
         (84, 13, 15, 11, "Action\n(trip plan,\ntime range)", "#E3ECF5")]
for x, y, w, h, t, c in boxes:
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4", fc=c, ec=N, lw=1.2))
    ax.text(x + w / 2, y + h / 2, t, ha="center", va="center", fontsize=7.4, color=INK)
for x1, x2 in [(18.4, 21.6), (39.4, 42.6), (60.4, 63.6), (80.4, 83.6)]:
    ax.annotate("", xy=(x2, 18.5), xytext=(x1, 18.5), arrowprops=dict(arrowstyle="-|>", color=N, lw=1.4))
ax.add_patch(FancyBboxPatch((33, 1), 37, 7, boxstyle="round,pad=0.4", fc="#F4F4F4", ec="#888", lw=1))
ax.text(51.5, 4.5, "Knowledge base: GTFS feed (stops, routes, patterns,\nfrequencies) + speed model by period", ha="center", va="center", fontsize=7.4)
ax.annotate("", xy=(51.5, 12.6), xytext=(51.5, 8.4), arrowprops=dict(arrowstyle="-|>", color="#888", lw=1.2))
ax.annotate("", xy=(9.5, 24.6), xytext=(91.5, 24.6), arrowprops=dict(arrowstyle="-|>", color=C2, lw=1.2, connectionstyle="arc3,rad=0.25"))
ax.text(50, 37.6, "feedback: the user changes the preference or the time and asks again", ha="center", fontsize=7.6, color=C2)
save(fig, "fig1_architecture.png")

# Fig. 2: pilot network from the GTFS feed
G = os.path.join(ROOT, "data", "gtfs")
stops = {r["stop_id"]: r for r in csv.DictReader(open(os.path.join(G, "stops.txt"), encoding="utf-8"))}
routes = {r["route_id"]: r for r in csv.DictReader(open(os.path.join(G, "routes.txt"), encoding="utf-8"))}
st = {}
for r in csv.DictReader(open(os.path.join(G, "stop_times.txt"), encoding="utf-8")):
    st.setdefault(r["trip_id"], []).append(r)
fig, ax = plt.subplots(figsize=(7.2, 3.9))
kx = np.cos(np.radians(4.44))
for i, (rid, r) in enumerate(routes.items()):
    seq = sorted(st[rid + "_0"], key=lambda x: int(x["stop_sequence"]))
    off = (i % 4 - 1.5) * 0.00018
    xs = [float(stops[s["stop_id"]]["stop_lon"]) * kx + off for s in seq]; ys = [float(stops[s["stop_id"]]["stop_lat"]) + off for s in seq]
    ax.plot(xs, ys, color="#" + r["route_color"], lw=2.2, solid_capstyle="round", label=f'{r["route_short_name"]} {r["route_long_name"]}', zorder=2)
for s in stops.values():
    ax.scatter(float(s["stop_lon"]) * kx, float(s["stop_lat"]), s=22, facecolor="white", edgecolor=INK, lw=1, zorder=3)
OFFS = {"S01": (-6, 6, "right"), "S05": (-6, -12, "right")}
for sid in ["S01", "S05", "S09", "S10", "S15", "S21", "S24", "S25", "S04"]:
    s = stops[sid]; dx, dy, ha = OFFS.get(sid, (4, 5, "left"))
    ax.annotate(s["stop_name"].replace(" (Centro)", ""), (float(s["stop_lon"]) * kx, float(s["stop_lat"])), xytext=(dx, dy), ha=ha,
                textcoords="offset points", fontsize=6.6, color=INK, zorder=4, path_effects=[pe.withStroke(linewidth=2.5, foreground="white")])
ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])
for sp in ax.spines.values(): sp.set_visible(False)
x0 = min(float(s["stop_lon"]) for s in stops.values()) * kx; y0 = min(float(s["stop_lat"]) for s in stops.values()) - 0.004
ax.plot([x0, x0 + 1 / 111.32], [y0, y0], color=INK, lw=2); ax.text(x0, y0 + 0.0008, "1 km", fontsize=7, color=INK)
ax.legend(loc="upper left", bbox_to_anchor=(1.0, 1.0), fontsize=6.8, frameon=False, title="Routes", title_fontsize=7.5)
save(fig, "fig2_network.png")

# Fig. 4: states expanded, A* vs Dijkstra
pers = [("peak", "Peak"), ("offpeak", "Off-peak"), ("night", "Night")]
d = [R["e1"][k]["expD"] for k, _ in pers]; a = [R["e1"][k]["expA"] for k, _ in pers]
fig, ax = plt.subplots(figsize=(4.2, 2.5)); x = np.arange(3); w = 0.36
b1 = ax.bar(x - w / 2 - 0.01, d, w, color=C2, label="Dijkstra (h = 0)"); b2 = ax.bar(x + w / 2 + 0.01, a, w, color=C1, label="A*")
for bars in (b1, b2):
    for bb in bars: ax.text(bb.get_x() + bb.get_width() / 2, bb.get_height() + 1, f"{bb.get_height():.1f}", ha="center", fontsize=7, color=INK)
ax.set_xticks(x); ax.set_xticklabels([p for _, p in pers]); ax.set_ylabel("Mean states expanded per query"); ax.set_ylim(0, max(d) * 1.2)
ax.yaxis.grid(True, color=GRID, lw=0.8); ax.set_axisbelow(True); ax.legend(frameon=False, fontsize=7.5, loc="upper right")
save(fig, "fig4_states.png")

# Fig. 5: preference trade-offs (small multiples, one measure per panel)
M = R["e3"]["modes"]; modes = [("fastest", "Fastest", C1), ("transfers", "Fewest\ntransfers", C2), ("walking", "Least\nwalking", C3)]
fig, axs = plt.subplots(1, 3, figsize=(7.0, 2.3))
for ax, (key, title, fmt) in zip(axs, [("total", "Mean trip time (min)", "{:.1f}"), ("transfers", "Mean transfers per trip", "{:.2f}"), ("walkM", "Mean walking (m)", "{:.0f}")]):
    vals = [M[m][key] for m, _, _ in modes]
    bars = ax.bar(range(3), vals, color=[c for _, _, c in modes], width=0.6)
    for bb, v in zip(bars, vals): ax.text(bb.get_x() + bb.get_width() / 2, v * 1.02, fmt.format(v), ha="center", fontsize=7, color=INK)
    ax.set_xticks(range(3)); ax.set_xticklabels([l for _, l, _ in modes], fontsize=7); ax.set_title(title, fontsize=8, color=INK)
    ax.set_ylim(0, max(vals) * 1.18); ax.yaxis.grid(True, color=GRID, lw=0.8); ax.set_axisbelow(True)
fig.tight_layout(); save(fig, "fig5_preferences.png")
print("figures written to", OUT)
