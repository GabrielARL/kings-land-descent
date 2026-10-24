#!/usr/bin/env python3
"""Each day the Wanderer minimises a different cost function, made from the day before.

This is the wall land of "Three Heroes Downhill": a quadratic valley

    f(x) = 1/2 (x - c)^T A (x - c)

and the lawful box [0, 1]^2.  Scaled ADMM with rope stiffness rho runs one circuit a day:

    aim        v[k-1] = z[k-1] - u[k-1]                  made from yesterday's numbers
    Wanderer   x[k]   = lowest point of F_k(x) = f(x) + rho/2 |x - v[k-1]|^2
    Warden     z[k]   = nearest lawful spot to x[k] + u[k-1]
    book       u[k]   = u[k-1] + x[k] - z[k]

With the rope alone there is no book: u stays 0, so the rope is tied to yesterday's Warden, v[k-1] = z[k-1].
Either way, today's cost F_k depends on yesterday's result, so the Wanderer solves a new problem every day.

The script prints both runs day by day and draws one panel per day: the contours of that day's cost F_k,
the spot its rope is tied to, how each twin moved, and the lawful box.

    python3 twins_day_by_day.py               # writes twins_days_1_to_4.png and twins_days_5_to_8.png
    python3 twins_day_by_day.py --show        # also opens the figures
    python3 twins_day_by_day.py --animate     # also writes twins_days.gif: the land morphing from day to day
    python3 twins_day_by_day.py --out DIR     # where to write the files (default: the current directory)
"""
import argparse
import os

import numpy as np
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

# ---- the wall land (source/simulator/engine.js, PRESETS.wall): curvatures 1 and 10, axes turned by 30 degrees
THETA = np.radians(30.0)
ROT = np.array([[np.cos(THETA), -np.sin(THETA)], [np.sin(THETA), np.cos(THETA)]])
A = ROT @ np.diag([1.0, 10.0]) @ ROT.T      # [[3.25, -3.897], [-3.897, 7.75]]
x̂AT = np.array([1.45, 0.75])               # the valley floor x̂, outside the box
LO, HI = 0.0, 1.0                           # the lawful box [0, 1]^2
RHO = 3.0                                   # the rope's stiffness
START = np.array([0.10, 0.15])              # both twins start here, with an empty book

WANDERER, WARDEN, AIM, BOOK, GOLD = '#111111', '#1f5fa8', '#7a3fb0', '#d9730d', '#c99a06'
LAND = LinearSegmentedColormap.from_list('land', ['#2f4f6f', '#9fb6cc', '#f4f7fa'])


def f(x):
    """The valley's height at x (any array whose last axis has length 2)."""
    d = x - x̂AT
    return 0.5 * np.einsum('...i,ij,...j->...', d, A, d)


def cost(x, aim):
    """Today's land: the valley plus the rope's bowl around the spot the rope is tied to."""
    return f(x) + RHO / 2 * np.sum((x - aim) ** 2, axis=-1)


def wanderer(aim):
    """The lowest point of today's land, where the land's pull and the rope's pull cancel:
    A (x - c) + rho (x - aim) = 0, that is (A + rho I) x = A c + rho aim."""
    return np.linalg.solve(A + RHO * np.eye(2), A @ x̂AT + RHO * aim)


def warden(w):
    """The nearest lawful spot: each number clipped into [0, 1]."""
    return np.clip(w, LO, HI)


def run(days, book=True):
    """One circuit a day.  Each record keeps the spot that day's rope was tied to."""
    x, z, u = START.copy(), warden(START), np.zeros(2)
    days_out = [dict(day=0, x=x, z=z, u=u, aim=None)]
    for k in range(1, days + 1):
        aim = z - u                       # made from yesterday's z and u
        x = wanderer(aim)                 # so today's cost F_k depends on yesterday
        z_new = warden(x + u)
        u = u + x - z_new if book else np.zeros(2)
        z = z_new
        days_out.append(dict(day=k, x=x, z=z, u=u.copy(), aim=aim))
    return days_out


def pair(v):
    return '(%6.3f, %6.3f)' % (v[0], v[1])


def sub(n):
    """A day number written as a subscript, as in the tutorial: 5 -> '₅'."""
    return str(n).translate(str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉'))


def short(v):
    return '(%.3f, %.3f)' % (v[0], v[1])


def print_run(days_out, name):
    print(name)
    print('  day  rope tied to         x, the Wanderer      z, the Warden        u, the book          gap')
    for r in days_out[1:]:
        print('  %3d  %s  %s  %s  %s  %.4f' % (r['day'], pair(r['aim']), pair(r['x']), pair(r['z']), pair(r['u']),
                                               np.linalg.norm(r['x'] - r['z'])))
    print()


def draw_day(ax, days_out, k, window, book):
    """One panel: day k's land F_k, the spot its rope is tied to, and both twins' moves."""
    r, prev = days_out[k], days_out[k - 1]
    xs = np.linspace(window[0], window[1], 260)
    ys = np.linspace(window[2], window[3], 260)
    X, Y = np.meshgrid(xs, ys)
    F = cost(np.stack([X, Y], axis=-1), r['aim'])
    levels = F.min() + (F.max() - F.min()) * np.linspace(0, 1, 18) ** 2
    ax.contourf(X, Y, F, levels=levels, cmap=LAND)
    ax.contour(X, Y, F, levels=levels, colors='white', linewidths=0.5, alpha=0.7)
    ax.plot([LO, HI, HI, LO, LO], [LO, LO, HI, HI, LO], color=WARDEN, lw=1.6)            # the lawful box
    ax.plot(*spot_to_dig(), marker='*', ms=11, color=GOLD, mec='k', mew=0.6, ls='')  # the spot to dig
    # where today's rope is tied: yesterday's Warden, moved back by the book when there is one
    if book and np.linalg.norm(prev['u']) > 1e-12:
        ax.annotate('', xy=r['aim'], xytext=prev['z'], arrowprops=dict(arrowstyle='->', color=BOOK, lw=1.6))
    ax.plot(*r['aim'], marker='X', ms=9, color=AIM, mec='white', mew=0.8, ls='')
    # the Wanderer goes to the lowest point of today's land, then the Warden steps to the nearest lawful spot
    ax.annotate('', xy=r['x'], xytext=prev['x'], arrowprops=dict(arrowstyle='->', color=WANDERER, lw=1.4))
    ax.plot(*prev['x'], marker='o', ms=6, mfc='none', mec=WANDERER, ls='')
    ax.plot(*r['x'], marker='o', ms=7, color=WANDERER, mec='white', mew=0.8, ls='')
    if np.linalg.norm(r['z'] - prev['z']) > 1e-9:
        ax.annotate('', xy=r['z'], xytext=prev['z'], arrowprops=dict(arrowstyle='->', color=WARDEN, lw=1.4, ls='--'))
    ax.plot(*r['z'], marker='s', ms=10, mfc='none', mec='white', mew=3.4, ls='')  # a white halo, then the Warden:
    ax.plot(*r['z'], marker='s', ms=10, mfc='none', mec=WARDEN, mew=1.8, ls='')   # hollow, so a Wanderer on it shows
    sk, sp = sub(k), sub(k - 1)
    spot = ('v' + sp) if book else ('z' + sp)
    made = ('v%s = z%s − u%s = %s' % (sp, sp, sp, short(r['aim']))) if book else ('z%s = %s' % (sp, short(r['aim'])))
    ax.set_title('day %d:  F%s(x) = f(x) + ρ/2·|x − %s|²\n%s' % (k, sk, spot, made), fontsize=9)
    ax.set_xlim(window[0], window[1])
    ax.set_ylim(window[2], window[3])
    ax.set_aspect('equal')
    ax.tick_params(labelsize=7)


def spot_to_dig():
    """The spot to dig: the lowest point of the valley inside the box (it lies on the wall x1 = 1)."""
    t = x̂AT[1] - A[0, 1] * (HI - x̂AT[0]) / A[1, 1]
    return np.array([HI, np.clip(t, LO, HI)])


def legend(fig):
    handles = [plt.Line2D([], [], marker='o', color=WANDERER, ls='', label='x, the Wanderer (hollow: yesterday)'),
               plt.Line2D([], [], marker='s', mfc='none', mec=WARDEN, mew=1.8, ls='', label='z, the Warden'),
               plt.Line2D([], [], marker='X', color=AIM, ls='', label='where today\'s rope is tied'),
               plt.Line2D([], [], color=BOOK, label='the book moves it back: -u'),
               plt.Line2D([], [], marker='*', color=GOLD, ls='', mec='k', label='the spot to dig'),
               plt.Line2D([], [], color=WARDEN, label='the lawful box')]
    fig.legend(handles=handles, loc='lower center', ncol=3, fontsize=8, frameon=False)


def figure_days(runs, days, window, path, title):
    aspect = (window[3] - window[2]) / (window[1] - window[0])
    fig, axes = plt.subplots(len(runs), len(days), figsize=(3.1 * len(days), (2.65 * aspect + 0.95) * len(runs) + 1.0), squeeze=False)
    for row, (name, days_out, book) in enumerate(runs):
        for col, k in enumerate(days):
            draw_day(axes[row][col], days_out, k, window, book)
        axes[row][0].set_ylabel(name, fontsize=10)
    fig.suptitle(title, fontsize=11)
    legend(fig)
    fig.tight_layout(rect=(0, 0.1, 1, 0.94))
    fig.savefig(path, dpi=150)
    print('wrote', path)
    return fig


def animate(days_out, window, path, frames_per_day=14):
    """The land morphs from one day's cost to the next.  The lowest point depends on the tied spot through an affine
    map, so the Wanderer, sitting at the lowest point while the spot slides, slides along a straight line too."""
    from matplotlib.animation import FuncAnimation, PillowWriter
    xs = np.linspace(window[0], window[1], 200)
    ys = np.linspace(window[2], window[3], 200)
    X, Y = np.meshgrid(xs, ys)
    P = np.stack([X, Y], axis=-1)
    fig, ax = plt.subplots(figsize=(5.2, 4.6))
    n_days = len(days_out) - 1

    def frame(i):
        k = 1 + i // frames_per_day
        t = (i % frames_per_day) / (frames_per_day - 1)
        r, prev = days_out[k], days_out[k - 1]
        aim0 = prev['aim'] if prev['aim'] is not None else prev['z']
        aim = (1 - t) * aim0 + t * r['aim']
        ax.clear()
        F = cost(P, aim)
        levels = F.min() + (F.max() - F.min()) * np.linspace(0, 1, 18) ** 2
        ax.contourf(X, Y, F, levels=levels, cmap=LAND)
        ax.contour(X, Y, F, levels=levels, colors='white', linewidths=0.5, alpha=0.7)
        ax.plot([LO, HI, HI, LO, LO], [LO, LO, HI, HI, LO], color=WARDEN, lw=1.6)
        ax.plot(*aim, marker='X', ms=10, color=AIM, mec='white', ls='')
        ax.plot(*wanderer(aim), marker='o', ms=8, color=WANDERER, mec='white', ls='')
        zt = prev['z'] if t < 1 else r['z']
        ax.plot(*zt, marker='s', ms=11, mfc='none', mec='white', mew=3.4, ls='')
        ax.plot(*zt, marker='s', ms=11, mfc='none', mec=WARDEN, mew=1.8, ls='')
        ax.set_xlim(window[0], window[1])
        ax.set_ylim(window[2], window[3])
        ax.set_aspect('equal')
        ax.set_title('day %d: the rope is re-tied, so the land changes\nrope tied at %s, lowest point %s'
                     % (k, short(aim), short(wanderer(aim))), fontsize=9)
        return []

    anim = FuncAnimation(fig, frame, frames=n_days * frames_per_day, blit=False)
    anim.save(path, writer=PillowWriter(fps=10))
    print('wrote', path)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--days', type=int, default=8)
    ap.add_argument('--out', default='.')
    ap.add_argument('--show', action='store_true')
    ap.add_argument('--animate', action='store_true')
    args = ap.parse_args()
    if not args.show:
        matplotlib.use('Agg')

    with_book = run(args.days, book=True)
    rope_alone = run(args.days, book=False)
    print_run(rope_alone, 'The rope alone (no book): the rope is tied to yesterday\'s Warden, z[k-1].')
    print_run(with_book, 'With the book (scaled ADMM): the rope is tied to the aim v[k-1] = z[k-1] - u[k-1].')

    # days 1-4 are the same in both runs: the book stays empty until the Wanderer first ends outside the wall (day 4)
    same = all(np.allclose(a['x'], b['x']) and np.allclose(a['z'], b['z']) for a, b in zip(with_book[:5], rope_alone[:5]))
    print('days 1-4 identical in both runs:', same)

    os.makedirs(args.out, exist_ok=True)
    figure_days([('both runs', with_book, True)], [1, 2, 3, 4], (-0.05, 1.6, -0.15, 1.1),
                os.path.join(args.out, 'twins_days_1_to_4.png'),
                'Days 1-4: each day the rope is tied to where yesterday ended, so each day\'s land is new')
    figure_days([('rope alone', rope_alone, False), ('with the book', with_book, True)], [5, 6, 7, 8], (0.74, 1.24, 0.38, 0.72),
                os.path.join(args.out, 'twins_days_5_to_8.png'),
                'Days 5-8: the rope alone ties the rope to z; the book ties it to z - u, further back each day')
    if args.animate:
        animate(with_book, (0.0, 1.5, -0.1, 1.05), os.path.join(args.out, 'twins_days.gif'))
    if args.show:
        plt.show()


if __name__ == '__main__':
    main()
