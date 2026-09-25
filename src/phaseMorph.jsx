import React from 'react';
import { css } from './css.js';

// Shared-element illustration for the "Five phases" section. One card holds a fixed set of pieces;
// each phase gives every piece a place, size and colour, and CSS transitions carry the pieces from
// one phase to the next instead of cross-fading five separate pictures:
//   brief bubbles -> story blocks -> the timeline's story strip -> the checked story bar -> the review scrubber
//   footage tiles -> V1 clips -> the picture bar -> the review player
//   playhead -> end of the check -> scrubber knob;  check boxes -> note timecodes;  version pill throughout
//
// Geometry is [x, y, w, h] on a 160×100 grid (the card is 16:10), so one unit is the same length on
// both axes. A phase entry of null hides the piece where it last was (or where it first appears);
// { hide: true, ... } hides it somewhere specific, and late: true fades it only after it has moved,
// which is how pieces merge into another one.

const EASE = 'cubic-bezier(.76,0,.24,1)', MOVE_MS = 700;
const LAV = '#b7a4d6', LAV_L = '#dcd2ee', TEAL = '#7fb7a8', AMBER = '#e7b86a', CREAM = '#fffdf8', DEEP = '#6f5a9a', BERRY = '#a3405c';
const FOOTAGE = 'repeating-linear-gradient(135deg,#dcd2ee 0 6px,#fffdf8 6px 12px)';
const AUDIO = 'repeating-linear-gradient(90deg,#7fb7a8 0 3px,#a8d0c5 3px 6px)';
const FILL = 'position:absolute;inset:0';
const TAG = "position:absolute;inset:0;display:flex;align-items:center;padding-left:1.6cqw;font:500 clamp(8px,2.3cqw,13px)/1 'Fira Code',monospace;color:#3b2d43;white-space:nowrap";
const PILL_TEXT = "position:absolute;inset:0;display:grid;place-items:center;font:500 clamp(8px,2.2cqw,12px)/1 'Fira Code',monospace;color:#3b2d43;white-space:nowrap";
const CHIP_TEXT = "position:absolute;inset:0;display:grid;place-items:center;font:500 clamp(7px,2cqw,11px)/1 'Fira Code',monospace;color:#fffdf8;white-space:nowrap";
const CHECK = 'position:absolute;left:34%;top:14%;width:30%;height:52%;border-right:3px solid #3b2d43;border-bottom:3px solid #3b2d43;transform:rotate(45deg)';

const TILE_X = [16, 49.25, 82.5, 115.75], TILE_H = [22, 30, 18, 26];
const CLIPS = [[16, 34], [51, 24], [76, 38], [115, 29]];
const PIC_BAR = [62, 82.75, 103.5, 124.25];
const PLAYER = [16, 8, 47.25, 84];

const s = text => ({ style: css(text) });

const footage = i => ({
  id: 'F' + i, stagger: i * 45, hideTf: 'translateY(-35%) scale(.9)',
  phases: [
    null,
    { at: [TILE_X[i], 50 - TILE_H[i], 28.25, TILE_H[i]], bg: LAV_L, r: '6px' },
    { at: [CLIPS[i][0], 36, CLIPS[i][1], 17], bg: LAV, r: '5px' },
    { at: [PIC_BAR[i], 39, 19.75, 6], bg: LAV, r: '3px', bw: '1.5px' },
    i === 0 ? { at: PLAYER, bg: LAV_L, r: '10px', z: 1 } : { hide: true, late: true, tf: 'none', at: PLAYER, bg: LAV_L, r: '10px', z: 0 }
  ],
  layers: [
    { show: i === 0 ? [1, 4] : [1], css: `${FILL};background:${FOOTAGE}` },
    ...(i === 0 ? [{ show: [4], css: FILL, children: [
      <span key="head" {...s('position:absolute;left:32%;top:22%;width:36%;aspect-ratio:1;border-radius:50%;background:#efe7d9;border:2px solid #3b2d43')}></span>,
      <span key="body" {...s('position:absolute;left:17%;right:17%;bottom:12%;height:38%;border-radius:40% 40% 8px 8px;background:#6f5a9a;border:2px solid #3b2d43')}></span>
    ] }] : [])
  ]
});

const check = i => ({
  id: 'C' + i, stagger: i * 90, hideTf: 'scale(.3)',
  phases: [null, null, null,
    { at: [16, 16 + i * 20, 12, 12], bg: TEAL, r: '7px', z: 3 },
    i < 2 ? { at: [79.5, 29 + i * 21, 17, 9], bg: DEEP, r: '5px', z: 3 } : null],
  layers: [
    { show: [3], css: CHECK },
    ...(i < 2 ? [{ show: [4], css: CHIP_TEXT, children: i ? '00:12' : '00:04' }] : [])
  ]
});

const rowLabel = (i, text) => ({
  id: 'K' + i, stagger: 60 + i * 90, hideTf: 'translateX(-12%)', border: false,
  css: "display:flex;align-items:center;font:500 clamp(9px,2.5cqw,14px)/1 'Fira Code',monospace;color:#3b2d43;white-space:nowrap",
  phases: [null, null, null, { at: [33, 16 + i * 20, 27, 12] }, null],
  children: text
});

const note = (i, text) => ({
  id: 'N' + i, stagger: 150 + i * 110, hideTf: 'translateX(22%)', css: 'box-shadow:2px 2px 0 #3b2d43',
  phases: [null, null, null, null, { at: [76, 26 + i * 21, 68, 15], bg: CREAM, r: '10px', z: 2 }],
  children: <span {...s("position:absolute;left:33%;top:0;bottom:0;display:flex;align-items:center;font-size:clamp(9px,2.5cqw,14px);color:#3b2d43;white-space:nowrap")}>{text}</span>
});

const PIECES = [
  { id: 'L',
    phases: [
      { at: [16, 22, 98, 26], bg: LAV_L, r: '16px 16px 16px 4px' },
      { at: [16, 63, 33.7, 15], bg: LAV, r: '8px' },
      { at: [16, 14, 36, 4], bg: LAV, r: '3px', bw: '1.5px' },
      { at: [62, 19, 26.67, 6], bg: LAV, r: '3px', bw: '1.5px' },
      { at: [20, 84.75, 11, 2.5], bg: LAV, r: '2px', bw: '1.5px', z: 3 }
    ],
    layers: [
      { show: [0], css: "position:absolute;left:0;top:0;width:61.25cqw;height:16.25cqw;display:flex;align-items:center;padding:0 2.8cqw;font-size:clamp(10px,2.9cqw,16px);line-height:1.35;color:#3b2d43", children: "A 40-second vertical short from today's recording." },
      { show: [1], css: TAG, children: 'open' }
    ] },
  { id: 'T', stagger: 30, hideTf: 'scale(.6)',
    phases: [
      null,
      { at: [54.7, 63, 56.2, 15], bg: TEAL, r: '8px' },
      { at: [53, 14, 55, 4], bg: TEAL, r: '3px', bw: '1.5px' },
      { at: [89.67, 19, 26.67, 6], bg: TEAL, r: '3px', bw: '1.5px' },
      { at: [31.5, 84.75, 16, 2.5], bg: TEAL, r: '2px', bw: '1.5px', z: 3 }
    ],
    layers: [{ show: [1], css: TAG, children: 'middle' }] },
  { id: 'A', stagger: 60,
    phases: [
      { at: [78, 56, 66, 18], bg: AMBER, r: '16px 16px 4px 16px' },
      { at: [115.9, 63, 28.1, 15], bg: AMBER, r: '8px' },
      { at: [109, 14, 35, 4], bg: AMBER, r: '3px', bw: '1.5px' },
      { at: [117.33, 19, 26.67, 6], bg: AMBER, r: '3px', bw: '1.5px' },
      { at: [48, 84.75, 11.25, 2.5], bg: AMBER, r: '2px', bw: '1.5px', z: 3 }
    ],
    layers: [
      { show: [0], css: "position:absolute;left:0;top:0;width:41.25cqw;height:11.25cqw;display:flex;align-items:center;gap:1.4cqw;padding:0 2.2cqw;font:700 clamp(10px,2.7cqw,15px)/1 'Baloo 2',sans-serif;color:#3b2d43;white-space:nowrap", children: [
        <span key="q" {...s('flex:none;width:3.3cqw;height:3.3cqw;display:grid;place-items:center;border-radius:.9cqw;background:#fffdf8;border:2px solid #3b2d43;font-size:clamp(8px,2cqw,13px)')}>?</span>,
        "Who's it for?"
      ] },
      { show: [1], css: TAG, children: 'close' }
    ] },
  footage(0), footage(1), footage(2), footage(3),
  { id: 'D', stagger: 80, hideTf: 'scaleX(0)', origin: '0 50%', border: false, css: 'border-top:2px dashed #6f5a9a',
    phases: [null, { at: [16, 56.5, 128, 0] }, null, null, null] },
  { id: 'G0', stagger: 60, hideTf: 'scale(.4)',
    phases: [null, null, { at: [30, 22, 26, 10], bg: AMBER, r: '5px' }, { hide: true, late: true, tf: 'none', at: [70, 39, 20, 6], r: '3px', bw: '1.5px', z: 1 }, null] },
  { id: 'G1', stagger: 120, hideTf: 'scale(.4)',
    phases: [null, null, { at: [88, 22, 24, 10], bg: AMBER, r: '5px' }, { hide: true, late: true, tf: 'none', at: [104, 39, 20, 6], r: '3px', bw: '1.5px', z: 1 }, null] },
  { id: 'S', stagger: 90, hideTf: 'scaleX(.15)', origin: '0 50%',
    phases: [
      null, null,
      { at: [16, 57, 128, 11], bg: TEAL, r: '5px' },
      { at: [62, 59, 82, 6], bg: TEAL, r: '3px', bw: '1.5px' },
      { hide: true, late: true, tf: 'none', at: [20, 84.75, 39.25, 2.5], r: '2px', bw: '1.5px', z: 2 }
    ],
    layers: [{ show: [2], css: `${FILL};background:${AUDIO}` }] },
  { id: 'P', stagger: 120, hideTf: 'scaleY(0)', origin: '50% 0', overflow: 'visible',
    phases: [
      null, null,
      { at: [98, 10, '3px', 62], bg: BERRY, r: '2px', bw: '0px', z: 4 },
      { at: [144, 10, '3px', 62], bg: BERRY, r: '2px', bw: '0px', z: 4 },
      { at: [30.5, 82.75, 6.5, 6.5], bg: BERRY, r: '50%', bw: '2px', z: 4 }
    ],
    layers: [{ show: [2, 3], css: 'position:absolute;left:50%;top:-4px;width:12px;height:14px;margin-left:-6px', children:
      <svg width="12" height="14" viewBox="0 0 12 14" {...s('display:block')}><path d="M1 1h10v7.5L6 13 1 8.5z" fill={BERRY} stroke="#3b2d43" strokeWidth="1.4" strokeLinejoin="round"></path></svg> }] },
  check(0), check(1), check(2),
  rowLabel(0, 'story'), rowLabel(1, 'picture'), rowLabel(2, 'sound'),
  note(0, 'Tighter here'), note(1, 'Love this bit'),
  { id: 'V', stagger: 150, hideTf: 'translateY(35%) scale(.9)', css: 'box-shadow:2px 2px 0 #3b2d43',
    phases: [
      null, null,
      { at: [16, 77, 40, 10], bg: CREAM, r: '999px', z: 3 },
      { at: [16, 77, 40, 10], bg: TEAL, r: '999px', z: 3 },
      { at: [76, 69, 52, 10], bg: AMBER, r: '999px', z: 3 }
    ],
    layers: [
      { show: [2], css: PILL_TEXT, children: 'v1 · playable' },
      { show: [3], css: PILL_TEXT, children: 'v1 · checked' },
      { show: [4], css: PILL_TEXT, children: 'round 1 · 2 notes' }
    ] }
];

function resolve(piece, i) {
  const own = piece.phases[i];
  if (own && !own.hide) return own;
  const first = piece.phases.findIndex(p => p && !p.hide);
  const base = i < first ? piece.phases[first] : resolve(piece, i - 1);
  return { ...base, ...own, hide: true };
}

const pc = n => `${+n.toFixed(3)}%`;

function pieceStyle(piece, i) {
  const st = resolve(piece, i), [x, y, w, h] = st.at, d = piece.stagger || 0, hidden = !!st.hide;
  const move = `${MOVE_MS}ms ${EASE} ${d}ms`;
  // Arriving pieces fade in partway through the move; merging pieces fade once they've reached their target.
  const fade = !hidden ? `opacity .35s ease ${250 + d}ms` : st.late ? `opacity .3s ease ${420 + d}ms` : `opacity .2s ease ${d}ms`;
  const pop = !hidden ? `transform .6s cubic-bezier(.2,1.3,.4,1) ${200 + d}ms` : `transform .35s ease ${d}ms`;
  return `position:absolute;left:${pc(x / 1.6)};top:${pc(y)};width:${typeof w === 'string' ? w : pc(w / 1.6)};height:${pc(h)};`
    + `z-index:${st.z ?? 2};background-color:${st.bg || 'transparent'};border-radius:${st.r || 0};`
    + (piece.border === false ? '' : `border:${st.bw || '2px'} solid #3b2d43;`)
    + `overflow:${piece.overflow || 'hidden'};transform-origin:${piece.origin || '50% 50%'};`
    + `opacity:${hidden ? 0 : 1};transform:${hidden ? st.tf || piece.hideTf || 'scale(.85)' : 'none'};`
    + `transition:left ${move},top ${move},width ${move},height ${move},border-radius ${move},border-width ${move},background-color .45s ease ${d}ms,${fade},${pop};`
    + (piece.css || '');
}

// Text inside a piece fades out as the piece starts moving and back in once it has settled.
const layerStyle = (layer, i) => {
  const on = layer.show.includes(i);
  return `${layer.css};opacity:${on ? 1 : 0};transition:opacity ${on ? '.3s ease .45s' : '.15s ease'}`;
};

export function morphPieces(phase) {
  return PIECES.map(p => ({
    id: p.id,
    style: pieceStyle(p, phase),
    children: p.children,
    layers: (p.layers || []).map(l => ({ style: layerStyle(l, phase), children: l.children }))
  }));
}
