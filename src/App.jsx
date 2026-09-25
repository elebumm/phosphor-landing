import React from 'react';
import { css } from './css.js';
import { morphPieces } from './phaseMorph.jsx';

// Hero timeline: a 40-second, 30 fps sequence. Picture Edit lays the V1/A1 cuts over PIC_MS,
// and the playhead in tickTimeline() moves at the same rate so it draws each clip as it passes.
const TL_SECONDS = 40, TL_FPS = 30, PIC_MS = 1500;

// Seeded waveform bars as one SVG path (viewBox 0 0 n 10). Integer LCG, so the server
// render and the browser produce identical markup.
function wave(seed, n, lo, hi) {
  let x = (seed * 7919) % 233280, d = '';
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    const h = Math.round((lo + (hi - lo) * x / 233280) * 10) / 10;
    d += `M${i + .2} ${(5 - h / 2).toFixed(2)}h.6v${h}h-.6z`;
  }
  return d;
}

const SHOTS = {
  a: { bg: 'repeating-linear-gradient(90deg,transparent 0 17px,rgba(59,45,67,.1) 17px 18.5px),#dcd2ee', thumb: 'repeating-linear-gradient(135deg,#c6b7df 0 4px,#b7a4d6 4px 8px)' },
  b: { bg: 'repeating-linear-gradient(90deg,transparent 0 17px,rgba(59,45,67,.1) 17px 18.5px),#cde5dd', thumb: 'repeating-linear-gradient(45deg,#a8d0c5 0 4px,#7fb7a8 4px 8px)' }
};
// V1 cuts (percent of the sequence), alternating the two camera angles. The cuts at 20% and 75% land on the story markers.
const CUTS = [[0, 11, 'a'], [11, 20, 'b'], [20, 38, 'a'], [38, 56, 'b'], [56, 75, 'a'], [75, 88, 'b'], [88, 100, 'a']].map(([l, r, shot], i) => {
  const n = Math.max(5, Math.round((r - l) * .9));
  return { l, r, left: l + '%', width: r - l + '%', ...SHOTS[shot], n, wave: wave(i + 1, n, 1, 9) };
});
const MUSIC = { n: 90, wave: wave(11, 90, 3.5, 8) };
const MARKS = [{ left: '0%', c: '#b7a4d6' }, { left: '20%', c: '#7fb7a8' }, { left: '75%', c: '#e7b86a' }];
const TITLES = [{ left: '2%', width: '29%', label: 'MY NEW DESK', bg: '#e7b86a' }, { left: '36%', width: '24%', label: 'day one', bg: '#efe7d9' }];
const RULER = ['00:00', '00:10', '00:20', '00:30'];
// Where each crew step's beam lands: null is the preview, anything else a timeline lane.
const BEAM_LANES = [null, null, ['ruler'], ['v1'], ['v2'], ['a1', 'a2'], [null, 'ruler'], null];
// Idle drift for the hero's floating squares: [x px, y px, degrees].
const DRIFT = [[5, -7, 12], [-6, 5, -14], [4, 6, 10], [-5, -6, -12], [6, 4, 16], [-4, -5, -10]];

// Installers come from the newest published release of the public feed; see loadRelease().
const RELEASES_REPO = 'https://github.com/elebumm/phosphor-releases';
const RELEASES_PAGE = RELEASES_REPO + '/releases/latest';
const RELEASE_API = 'https://api.github.com/repos/elebumm/phosphor-releases/releases/latest';
const SITE_URL = 'https://phosphorai.app/';

const FAQ = [
  { q: 'What does it cost?', a: 'Phosphor is a free download. The AI work runs through your own Codex or Claude Code account, so it uses that plan rather than a separate subscription.' },
  { q: 'Which editing apps does it work with?', a: 'DaVinci Resolve and After Effects. Premiere support is on the way.' },
  { q: 'Do I need Codex or Claude Code?', a: 'Yes, one of them. Phosphor’s agent runs through the Codex or Claude Code command-line tool, signed in with your own account. The first time you open Phosphor, it checks for the tool and tells you if it’s missing.' },
  { q: 'Does my footage leave my computer?', a: 'Your footage and projects stay on your computer. The agent works through your own Codex or Claude Code sign-in, so anything it sends to the AI model is covered by that account. Phosphor never asks for your passwords.' },
  { q: 'What computer do I need?', a: 'A Mac with macOS 13 or later (Apple silicon or Intel), or a 64-bit Windows PC. Windows support is in beta. You also need Python 3.11 or newer and FFmpeg, plus free space of about three times your footage and another 2 GB.' },
  { q: 'How do updates work?', a: 'Phosphor checks for new versions on its own. Depending on your computer, it either installs the update when you quit or shows you a link to download it.' }
];

export default class App extends React.Component {
  state = { os: 'mac', osKnown: false, arch: null, rel: null, copied: false, exPlaying: false, exMuted: true, phase: 0, mStep: 4, clips: 10, notes: 3, answered: true, controlOn: false, handed: false, spread: false, hover: false, ticks: 4, narrow: false };
  rootRef = React.createRef(); logoRef = React.createRef(); heroRef = React.createRef(); glowRef = React.createRef();
  phasesRef = React.createRef(); lineRef = React.createRef(); fillRef = React.createRef(); beadRef = React.createRef();
  mockRef = React.createRef(); burstRef = React.createRef(); tcRef = React.createRef(); tlRef = React.createRef(); playheadRef = React.createRef();
  controlRef = React.createRef(); knobRef = React.createRef(); cursorRef = React.createRef(); stopRef = React.createRef();
  deckRef = React.createRef(); localRef = React.createRef(); miniEyesRef = React.createRef(); shackleRef = React.createRef(); checkRef = React.createRef();
  stageRef = React.createRef(); videoRef = React.createRef(); tlHeadRef = React.createRef(); tlCheckRef = React.createRef(); tlTcRef = React.createRef();
  exVideoRef = React.createRef(); exBarRef = React.createRef();
  timers = []; mockTimers = []; crewTimers = []; observers = []; anims = []; heroAnims = [];

  componentDidMount() {
    const reduced = this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Phones and tablets can't install Phosphor. iPadOS reports itself as a Mac, so touch support tells them apart.
    const uad = navigator.userAgentData, ua = navigator.userAgent || '';
    const plat = ((uad && uad.platform) || navigator.platform || '').toLowerCase();
    const mobile = (uad && uad.mobile) || /iphone|ipad|ipod|android/i.test(ua) || (plat === 'macintel' && navigator.maxTouchPoints > 1);
    const os = mobile ? 'mobile' : /win/.test(plat) ? 'windows' : /mac/.test(plat) ? 'mac' : plat ? 'other' : null;
    this.setState({ os: os || 'mac', osKnown: !!os, narrow: window.innerWidth < 760, ...(reduced ? {} : { mStep: 0, clips: 0, notes: 0, answered: false, ticks: 0 }) });
    // Chromium can say whether a Mac is Apple silicon ("arm") or Intel ("x86"); other browsers get the Apple silicon build first.
    if (os === 'mac' && uad && uad.getHighEntropyValues) uad.getHighEntropyValues(['architecture']).then(h => this.setState({ arch: h.architecture || null })).catch(() => {});
    this.loadRelease();
    this.setupExample(reduced);
    this.onResize = () => { const n = window.innerWidth < 760; if (n !== this.state.narrow) this.setState({ narrow: n }); this.scheduleScroll(); };
    window.addEventListener('resize', this.onResize);

    this.onScroll = () => this.scheduleScroll();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.scheduleScroll();

    const root = this.rootRef.current;
    this.setupReveals(root, reduced);
    if (reduced) { this.ticksDone = true; return; }

    const anim = (el, kf, opts) => { if (!el || !el.animate) return null; try { const a = el.animate(kf, opts); this.anims.push(a); return a; } catch (e) { return null; } };
    this.anim = anim;
    this.setupHero();
    const px = this.logoRef.current ? Array.from(this.logoRef.current.children) : [];
    px.forEach(p => anim(p, [
      { transform: `translate(${(Math.random() - .5) * 90}px,${(Math.random() - .5) * 60}px) scale(.3)`, opacity: 0 },
      { transform: 'none', opacity: 1 }
    ], { duration: 650, delay: 80 + Math.random() * 600, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'backwards' }));
    root.querySelectorAll('[data-pulse]').forEach((el, i) => anim(el, [
      { transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 1, offset: .12 }, { transform: 'scale(1)', opacity: .6, offset: .35 }, { transform: 'scale(1)', opacity: 1 }
    ], { duration: 2400, delay: (i % 4) * 280, iterations: Infinity }));
    root.querySelectorAll('[data-float]').forEach((el, i) => anim(el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }], { duration: 3200 + i * 500, iterations: Infinity, easing: 'ease-in-out' }));
    // The squares' wrappers carry the scroll parallax; the drift goes on the square itself so the two don't fight.
    root.querySelectorAll('[data-drift]').forEach((el, i) => {
      const [x, y, r] = DRIFT[i % DRIFT.length], e = 'ease-in-out';
      anim(el, [
        { transform: 'translate(0,0) rotate(0deg)', easing: e },
        { transform: `translate(${x}px,${y}px) rotate(${r}deg)`, easing: e },
        { transform: `translate(${-x * .6}px,${y * .4}px) rotate(${-r * .5}deg)`, easing: e },
        { transform: 'translate(0,0) rotate(0deg)' }
      ], { duration: 5200 + i * 700, delay: -i * 900, iterations: Infinity });
    });
    root.querySelectorAll('[data-mockanim]').forEach(el => {
      const k = el.getAttribute('data-mockanim');
      const kf = k === 'a' ? [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(40%,20%) scale(.8)' }, { transform: 'translate(10%,45%) scale(1.1)' }, { transform: 'translate(0,0) scale(1)' }]
        : k === 'b' ? [{ transform: 'translateX(-120%)' }, { transform: 'translateX(0)', offset: .25 }, { transform: 'translateX(0)', offset: .8 }, { transform: 'translateX(140%)' }]
        : [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(0)', opacity: 0, offset: .3 }, { transform: 'scaleX(1)', opacity: 1, offset: .45 }, { transform: 'scaleX(1)', opacity: 1, offset: .85 }, { transform: 'scaleX(0)', opacity: 0 }];
      anim(el, kf, { duration: k === 'a' ? 6000 : 4000, iterations: Infinity, easing: 'ease-in-out' });
      if (k === 'c') el.style.transformOrigin = '0 50%';
    });
    anim(this.miniEyesRef.current, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1)', offset: .9 }, { transform: 'scaleY(.1)', offset: .95 }, { transform: 'scaleY(1)' }], { duration: 3600, iterations: Infinity });

    this.mx = window.innerWidth * .7; this.my = 300; this.gx = this.mx; this.gy = this.my;
    this.onMove = e => { this.mx = e.clientX; this.my = e.clientY; };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    this.raf = requestAnimationFrame(loop);

    root.querySelectorAll('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        el.style.transition = 'transform .12s ease-out';
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px,${(e.clientY - r.top - r.height / 2) * .35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .5s cubic-bezier(.2,1.6,.4,1)'; el.style.transform = ''; });
    });

    this.observe(this.mockRef.current, 0.25, vis => { this.mockVisible = vis; vis ? this.runMock() : this.stopMock(); });
    this.observe(this.deckRef.current, [0, .35, .6], (vis, ratio) => { if (ratio > .35) { if (!this.state.spread) this.setState({ spread: true }); } else if (ratio < .1 && this.state.spread) this.setState({ spread: false }); });
    this.observe(this.checkRef.current, .35, vis => { if (vis && !this.ticksDone) { this.ticksDone = true; [0, 1, 2, 3].forEach(i => this.timers.push(setTimeout(() => this.setState({ ticks: i + 1 }), 400 + i * 550))); } });
    if (this.shackleRef.current) this.shackleRef.current.style.transform = 'translateY(-16px)';
    this.observe(this.localRef.current, .4, vis => { if (vis && !this.locked) { this.locked = true; anim(this.shackleRef.current, [{ transform: 'translateY(-16px)' }, { transform: 'translateY(3px)', offset: .6 }, { transform: 'translateY(0)' }], { duration: 600, delay: 350, easing: 'ease-in', fill: 'forwards' }); } });
    this.observe(this.controlRef.current, .4, vis => { if (vis && !this.nudged) { this.nudged = true; anim(this.knobRef.current, [{ transform: 'translateX(0)' }, { transform: 'translateX(9px)', offset: .2 }, { transform: 'translateX(0)', offset: .4 }, { transform: 'translateX(9px)', offset: .6 }, { transform: 'translateX(0)', offset: .8 }], { duration: 900, delay: 500 }); } });
  }

  // The newest published release decides what the download buttons do: direct installer links once one
  // exists, "coming soon" before the first release, and the Releases page if GitHub can't be reached.
  loadRelease() {
    fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(r => (r.status === 404 ? null : r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => {
        if (!data) return this.setState({ rel: 'none' });
        const pick = re => { const a = (data.assets || []).find(x => re.test(x.name)); return a ? { url: a.browser_download_url, size: a.size } : null; };
        const rel = { version: String(data.tag_name || '').replace(/^v/, ''), mac: pick(/-mac-arm64\.dmg$/), macIntel: pick(/-mac-x64\.dmg$/), win: pick(/-win-x64-setup\.exe$/) };
        if (rel.mac || rel.macIntel || rel.win) this.setState({ rel });
      })
      .catch(() => {});
  }

  // The example short plays muted while it's on screen, like a GIF; its buttons add sound and pause it.
  setupExample(reduced) {
    const video = this.exVideoRef.current;
    if (!video) return;
    video.muted = true;
    const sync = () => this.setState({ exPlaying: !video.paused, exMuted: video.muted });
    ['play', 'pause', 'volumechange'].forEach(e => video.addEventListener(e, sync));
    video.addEventListener('timeupdate', () => {
      const bar = this.exBarRef.current;
      if (bar && video.duration) bar.style.transform = `scaleX(${(video.currentTime / video.duration).toFixed(4)})`;
    });
    if (!reduced) this.observe(video, .5, vis => {
      if (vis && !this.exUserPaused) video.play().catch(() => {});
      else if (!vis && !video.paused) video.pause();
    });
  }

  exToggle = () => {
    const video = this.exVideoRef.current;
    if (!video) return;
    if (video.paused) { this.exUserPaused = false; video.play().catch(() => {}); }
    else { this.exUserPaused = true; video.pause(); }
  };

  exSound = () => {
    const video = this.exVideoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.paused) { this.exUserPaused = false; video.play().catch(() => {}); }
  };

  // "Watch with sound" starts the short over from the top with sound on.
  exWatch = () => {
    const video = this.exVideoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    this.exUserPaused = false;
    video.play().catch(() => {});
  };

  // Phones can't install Phosphor, so they get a way to send the link to a computer.
  shareLink = () => {
    if (navigator.share) { navigator.share({ title: 'Phosphor', text: 'Your AI editing crew, on your own computer', url: SITE_URL }).catch(() => {}); return; }
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(SITE_URL).then(() => {
      this.setState({ copied: true });
      clearTimeout(this.copiedT); this.copiedT = setTimeout(() => this.setState({ copied: false }), 2500);
    }).catch(() => {});
  };

  downloads(v) {
    const d = v.dl;
    const button = (b, bg, shadow) => (
      <span data-magnetic="" style={css(`display:inline-flex`)}>
        <a href={b.href} style={css(`display:inline-flex;flex-direction:column;justify-content:center;gap:6px;min-height:60px;padding:10px 22px;border:2px solid #3b2d43;border-radius:14px;background:${bg};box-shadow:${shadow};color:#3b2d43;text-decoration:none;transition:transform .15s,box-shadow .15s`)} className="btn-download">
          <span style={css(`font:800 19px/1 'Baloo 2',sans-serif`)}>{b.title}</span>
          <span style={css(`font:500 11px/1 'Fira Code',monospace;color:#4a3b54`)}>{b.sub}</span>
        </a>
      </span>
    );
    return (
      <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
        <div style={css(`display:flex;flex-wrap:wrap;gap:14px`)}>
          {button(d.mac, v.macBg, v.macShadow)}
          {button(d.win, v.winBg, v.winShadow)}
        </div>
        <span style={css(`display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font:500 13px/1.5 'Fira Code',monospace;color:#2f6b5e;min-height:20px`)}>
          {v.osNote}
          {d.macOther && <a href={d.macOther.href} style={css(`color:#6f5a9a`)}>{d.macOther.label}</a>}
          {v.showShare && <button type="button" onClick={v.share} style={css(`padding:6px 12px;border:2px solid #3b2d43;border-radius:10px;background:#fffdf8;box-shadow:2px 2px 0 #3b2d43;color:#3b2d43;font:700 15px/1 'Baloo 2',sans-serif;cursor:pointer`)}>{v.shareLabel}</button>}
        </span>
      </div>
    );
  }

  setupHero() {
    this.heroAnims.forEach(a => a.cancel()); this.heroAnims = [];
    this.stopCrew();
    const stage = this.stageRef.current;
    if (this.reduced || !stage) return;
    const A = (el, kf, o) => { if (!el || !el.animate) return null; try { const a = el.animate(kf, o); this.heroAnims.push(a); return a; } catch (e) { return null; } };
    const q = k => Array.from(stage.querySelectorAll(`[data-v="${k}"]`));
    q('shotB').forEach(el => A(el, [{ opacity: 0 }, { opacity: 0, offset: .49 }, { opacity: 1, offset: .5 }, { opacity: 1, offset: .99 }, { opacity: 0 }], { duration: 1800, iterations: Infinity }));
    q('bar').forEach((el, i) => A(el, [{ transform: 'scaleY(.25)' }, { transform: `scaleY(${.5 + (i * 7 % 5) / 10})` }, { transform: 'scaleY(.3)' }, { transform: `scaleY(${.7 + (i * 3 % 4) / 12})` }, { transform: 'scaleY(.25)' }], { duration: 900 + (i % 5) * 140, iterations: Infinity, easing: 'ease-in-out' }));
    q('scan').forEach(el => { const h = el.parentElement.offsetHeight || 440; A(el, [{ transform: 'translateY(0)' }, { transform: `translateY(${h}px)` }], { duration: 1100, iterations: Infinity, easing: 'ease-in-out', direction: 'alternate' }); });
    q('ring').forEach(el => A(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 1400, iterations: Infinity, easing: 'ease-in-out' }));
    q('progress').forEach(el => { this.progressAnim = A(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 3400, iterations: Infinity }); });
    stage.querySelectorAll('[data-crew-av]').forEach((el, i) => A(el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }], { duration: 1800 + i * 230, iterations: Infinity, easing: 'ease-in-out', composite: 'add' }));
    this.runCrew();
  }

  stopCrew() { this.crewTimers.forEach(clearTimeout); this.crewTimers = []; }

  hopAv(id, big) {
    const el = this.stageRef.current && this.stageRef.current.querySelector(`[data-crew-av="${id}"]`);
    if (!el) return;
    el.animate(big
      ? [{ transform: 'scale(1,1)' }, { transform: 'scale(1.15,.85)', offset: .2 }, { transform: 'translateY(-14px) scale(.95,1.08) rotate(-6deg)', offset: .5 }, { transform: 'scale(1,1)' }]
      : [{ transform: 'scale(1,1)' }, { transform: 'scale(1.15,.85)', offset: .3 }, { transform: 'translateY(-7px) scale(.96,1.05)', offset: .6 }, { transform: 'scale(1,1)' }],
      { duration: big ? 750 : 450, easing: 'ease-out', composite: 'add' });
  }

  beam(id, color, lanes) {
    const stage = this.stageRef.current, v = this.videoRef.current; if (!stage || !v) return;
    const av = stage.querySelector(`[data-crew-av="${id}"]`); if (!av) return;
    const sr = stage.getBoundingClientRect(), ar = av.getBoundingClientRect();
    const p0 = { x: ar.left - sr.left + ar.width / 2, y: ar.top - sr.top + ar.height / 2 };
    for (let i = 0; i < 4; i++) {
      const lane = lanes && lanes[i % lanes.length];
      const target = (lane && stage.querySelector(`[data-lane="${lane}"]`)) || v, tr = target.getBoundingClientRect();
      const p1 = target === v
        ? { x: tr.left - sr.left + tr.width * (.3 + Math.random() * .4), y: tr.top - sr.top + tr.height * (.25 + Math.random() * .5) }
        : { x: tr.left - sr.left + tr.width * (.08 + Math.random() * .84), y: tr.top - sr.top + tr.height * (.3 + Math.random() * .4) };
      const t = document.createElement('span'), sz = 7 + Math.random() * 4;
      t.style.cssText = `position:absolute;left:${-sz / 2}px;top:${-sz / 2}px;width:${sz}px;height:${sz}px;background:${color};border:1.5px solid #3b2d43;box-shadow:0 0 10px ${color};pointer-events:none;z-index:5`;
      stage.appendChild(t);
      const h = 30 + Math.random() * 40, kf = [];
      for (let j = 0; j <= 10; j++) { const e = j / 10; kf.push({ transform: `translate(${p0.x + (p1.x - p0.x) * e}px,${p0.y + (p1.y - p0.y) * e - Math.sin(Math.PI * e) * h}px) rotate(${e * 270}deg) scale(${1 - e * .5})`, opacity: e > .9 ? 0 : 1 }); }
      t.animate(kf, { duration: 650, delay: i * 90, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'backwards' }).onfinish = () => t.remove();
    }
  }

  runCrew() {
    this.stopCrew();
    if (this.reduced || !this.stageRef.current) return;
    const at = (ms, fn) => this.crewTimers.push(setTimeout(fn, ms));
    const ORDER = ['director', 'research', 'story', 'picture', 'graphics', 'sound', 'qc', 'director'];
    const COL = ['#b7a4d6', '#e7b86a', '#b7a4d6', '#7fb7a8', '#e7b86a', '#7fb7a8', '#7fb7a8', '#e7b86a'];
    // crewK/crewAt mirror crewStep synchronously for the rAF playhead; React applies the state a tick later.
    this.crewK = -1; this.crewAt = performance.now();
    this.setState({ crewStep: -1 });
    ORDER.forEach((r, i) => at(500 + i * 1900, () => {
      this.crewK = i; this.crewAt = performance.now();
      if (i === 7 && this.progressAnim) this.progressAnim.currentTime = 0;
      this.setState({ crewStep: i });
      this.hopAv(r, i === 7);
      this.beam(r, COL[i], BEAM_LANES[i]);
      if (i === 7) this.crewBurst();
    }));
    at(500 + 7 * 1900 + 3800, () => this.runCrew());
  }

  crewBurst() {
    const stage = this.stageRef.current, v = this.videoRef.current; if (!stage || !v || this.reduced) return;
    const sr = stage.getBoundingClientRect(), r = v.getBoundingClientRect();
    const cx = r.left - sr.left + r.width / 2, cy = r.top - sr.top + r.height * .5;
    const cols = ['#b7a4d6', '#7fb7a8', '#e7b86a', '#a3405c', '#fffdf8'];
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('span'), sz = 6 + Math.random() * 6;
      s.style.cssText = `position:absolute;left:${cx - sz / 2}px;top:${cy - sz / 2}px;width:${sz}px;height:${sz}px;background:${cols[i % 5]};border:1.5px solid #3b2d43;pointer-events:none;z-index:6`;
      stage.appendChild(s);
      const a = (i / 24) * Math.PI * 2, dist = 120 + Math.random() * 80;
      s.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px) rotate(${Math.random() * 200}deg)`, opacity: 1, offset: .6 }, { transform: `translate(${Math.cos(a) * dist * 1.15}px,${Math.sin(a) * dist * 1.15 + 24}px) scale(.6)`, opacity: 0 }], { duration: 1000 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove();
    }
  }

  observe(el, threshold, cb) {
    if (!el) return;
    const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting, e.intersectionRatio)), { threshold });
    io.observe(el); this.observers.push(io);
  }

  setupReveals(root, reduced) {
    const els = root.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.style.opacity = '1'; e.target.style.transform = 'none'; io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    const show = el => { el.style.opacity = '1'; el.style.transform = 'none'; };
    this.timers.push(setTimeout(() => els.forEach(show), 1800));
    this.onPrint = () => els.forEach(el => { el.style.transition = 'none'; show(el); });
    window.addEventListener('beforeprint', this.onPrint);
    els.forEach(el => {
      const d = +el.getAttribute('data-reveal') || 0;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        if (reduced || document.visibilityState === 'hidden') return;
        this.anims.push(el.animate([{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: d, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
        return;
      }
      el.style.opacity = '0';
      if (reduced) el.style.transition = `opacity .5s ease ${d}ms`;
      else { el.style.transform = 'translateY(28px)'; el.style.transition = `opacity .7s ease ${d}ms, transform .8s cubic-bezier(.2,.8,.2,1) ${d}ms`; }
      io.observe(el);
    });
    this.observers.push(io);
  }

  frame() {
    const hero = this.heroRef.current; if (!hero) return;
    const hr = hero.getBoundingClientRect();
    if (hr.bottom >= 0) {
      this.gx += (this.mx - hr.left - this.gx) * .08; this.gy += (this.my - hr.top - this.gy) * .08;
      if (this.glowRef.current) this.glowRef.current.style.transform = `translate3d(${this.gx - 320}px,${this.gy - 320}px,0)`;
      this.tickTimeline(performance.now());
    }
    const tl = this.tlRef.current, ph = this.playheadRef.current;
    if (this.mockVisible && tl && ph) {
      const t = (performance.now() / 1000) % 32;
      ph.style.transform = `translate3d(${(t / 32) * tl.offsetWidth}px,0,0)`;
      const sec = Math.floor(t);
      if (sec !== this.lastSec && this.tcRef.current) { this.lastSec = sec; this.tcRef.current.textContent = `00:${String(sec).padStart(2, '0')} / 00:32`; }
    }
  }

  // Playhead, QC check bar and timecode for the hero timeline, following the crew step:
  // Picture Edit draws the cuts, Graphics parks on the title, Sound scrubs, QC sweeps and checks, Ready plays.
  tickTimeline(now) {
    const k = this.crewK, head = this.tlHeadRef.current;
    if (k == null || !head) return;
    if (k !== this.tlStep) { this.tlStep = k; this.tlFrom = this.tlPos || 0; }
    const t = now - this.crewAt;
    const clamp = x => Math.min(1, Math.max(0, x)), smooth = x => x * x * (3 - 2 * x);
    const path = k === 3 ? x => clamp(x / PIC_MS)
      : k === 4 ? () => .02
      : k === 5 ? x => .02 + .44 * smooth(clamp(x / 1700))
      : k === 6 ? x => smooth(clamp(x / 1700))
      : k === 7 ? x => (x % 3400) / 3400
      : () => 0;
    // Glide from wherever the previous step left the playhead onto this step's path.
    const pos = path(t) + (this.tlFrom - path(0)) * (1 - smooth(clamp(t / 350)));
    this.tlPos = pos;
    head.style.transform = `translateX(${(pos * 100).toFixed(2)}%)`;
    const check = k === 6 ? path(t) : k === 7 || k === -1 ? 1 : 0;
    if (check !== this.tlCheck && this.tlCheckRef.current) { this.tlCheck = check; this.tlCheckRef.current.style.transform = `scaleX(${check.toFixed(4)})`; }
    const frames = Math.round(pos * TL_SECONDS * TL_FPS);
    if (frames !== this.tlFrames && this.tlTcRef.current) {
      this.tlFrames = frames;
      const pad = n => String(n).padStart(2, '0');
      this.tlTcRef.current.textContent = `00:00:${pad(Math.floor(frames / TL_FPS))}:${pad(frames % TL_FPS)}`;
    }
  }

  scheduleScroll() {
    if (this.scrollQueued) return; this.scrollQueued = true;
    requestAnimationFrame(() => { this.scrollQueued = false; this.updateScroll(); });
  }

  updateScroll() {
    const sec = this.phasesRef.current;
    if (sec) {
      const r = sec.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      const phase = Math.min(4, Math.floor(p * 5 + .0001));
      const w = this.lineRef.current ? this.lineRef.current.offsetWidth : 0;
      const bp = Math.min(1, Math.max(0, (p * 5 - .5) / 4));
      if (this.fillRef.current) this.fillRef.current.style.transform = `scaleX(${bp.toFixed(4)})`;
      if (this.beadRef.current) this.beadRef.current.style.transform = `translate3d(${(bp * w).toFixed(1)}px,0,0)`;
      if (phase !== this.state.phase) this.setState({ phase });
    }
    if (!this.reduced && this.heroRef.current) {
      const top = this.heroRef.current.getBoundingClientRect().top;
      if (top > -window.innerHeight) this.heroRef.current.querySelectorAll('[data-parallax]').forEach(el => {
        // data-parallax-max keeps the stage inside the hero's bottom padding so the timeline isn't clipped.
        const max = parseFloat(el.getAttribute('data-parallax-max')) || Infinity;
        const y = Math.max(-max, Math.min(max, top * parseFloat(el.getAttribute('data-parallax'))));
        el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
      });
    }
  }

  runMock() {
    this.stopMock();
    const at = (ms, fn) => this.mockTimers.push(setTimeout(fn, ms));
    this.setState({ mStep: 0, clips: 0, notes: 0, answered: false });
    for (let i = 1; i <= 10; i++) at(200 + i * 240, () => this.setState({ clips: i }));
    at(3300, () => this.setState({ mStep: 1 }));
    at(5000, () => this.setState({ answered: true }));
    at(5800, () => this.setState({ mStep: 2 }));
    at(6500, () => this.setState({ notes: 1 }));
    at(7300, () => this.setState({ notes: 2 }));
    at(8100, () => this.setState({ notes: 3 }));
    at(9400, () => this.setState({ mStep: 3 }));
    at(11600, () => { this.setState({ mStep: 4 }); this.burst(); });
    at(17000, () => this.runMock());
  }
  stopMock() { this.mockTimers.forEach(clearTimeout); this.mockTimers = []; }

  burst() {
    const host = this.burstRef.current; if (!host || this.reduced) return;
    const cols = ['#b7a4d6', '#7fb7a8', '#e7b86a', '#a3405c', '#fffdf8'];
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('span');
      const sz = 6 + Math.random() * 6;
      s.style.cssText = `position:absolute;left:${-sz / 2}px;top:${-sz / 2}px;width:${sz}px;height:${sz}px;background:${cols[i % 5]};border:1.5px solid #3b2d43;`;
      host.appendChild(s);
      const a = (i / 22) * Math.PI * 2 + Math.random() * .3, d = 50 + Math.random() * 70;
      s.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) rotate(${Math.random() * 180}deg) scale(1)`, opacity: 1, offset: .6 }, { transform: `translate(${Math.cos(a) * d * 1.2}px,${Math.sin(a) * d * 1.2 + 20}px) scale(.6)`, opacity: 0 }], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.controlOn !== this.state.controlOn && !this.reduced) {
      if (this.cursorAnim) { this.cursorAnim.cancel(); this.cursorAnim = null; }
      if (this.state.controlOn && this.cursorRef.current) {
        this.cursorAnim = this.cursorRef.current.animate([
          { transform: 'translate(40px,90px)' }, { transform: 'translate(120px,20px)', offset: .25 }, { transform: 'translate(220px,96px)', offset: .5 }, { transform: 'translate(80px,100px)', offset: .75 }, { transform: 'translate(40px,90px)' }
        ], { duration: 4200, iterations: Infinity, easing: 'ease-in-out' });
      }
    }
  }

  componentWillUnmount() {
    this.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); clearTimeout(this.handT); this.stopMock(); this.stopCrew(); this.heroAnims.forEach(a => a.cancel());
    this.observers.forEach(o => o.disconnect()); this.anims.forEach(a => a.cancel());
    cancelAnimationFrame(this.raf);
    window.removeEventListener('beforeprint', this.onPrint);
    window.removeEventListener('resize', this.onResize); window.removeEventListener('scroll', this.onScroll); window.removeEventListener('pointermove', this.onMove);
  }

  pixels(screen) {
    const out = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 12; c++) {
      const frame = r < 2 || r > 6 || c < 2 || c > 9;
      const eye = r === 4 && (c === 4 || c === 7);
      out.push({ c: frame || eye ? '#3b2d43' : screen });
    }
    return out;
  }

  renderVals() {
    const s = this.state;
    const primary = { bg: '#e7b86a', sh: '4px 4px 0 #3b2d43' }, secondary = { bg: '#fffdf8', sh: '2px 2px 0 #3b2d43' };
    const mac = s.os === 'mac', win = s.os === 'windows';

    // Download buttons: straight to the installer once a release is out, "coming soon" before the first one,
    // and the Releases page until GitHub has answered (or if it can't be reached).
    const rel = s.rel && typeof s.rel === 'object' ? s.rel : null, soon = s.rel === 'none';
    const mb = n => `${Math.max(1, Math.round(n / 1048576))} MB`;
    const macMain = rel && ((s.arch === 'x86' ? rel.macIntel : rel.mac) || rel.mac || rel.macIntel);
    const macOther = rel && (macMain === rel.mac ? rel.macIntel : rel.mac);
    const macKind = f => (f === rel.mac ? 'Apple silicon' : 'Intel');
    const dl = {
      mac: soon ? { href: RELEASES_REPO, title: 'Mac: coming soon', sub: 'Get notified on GitHub' }
        : macMain ? { href: macMain.url, title: 'Download for Mac', sub: `${macKind(macMain)} · ${mb(macMain.size)}` }
        : { href: RELEASES_PAGE, title: 'Download for Mac', sub: 'macOS 13 or later' },
      win: soon ? { href: RELEASES_REPO, title: 'Windows: coming soon', sub: 'Get notified on GitHub' }
        : rel && rel.win ? { href: rel.win.url, title: 'Download for Windows', sub: `64-bit · beta · ${mb(rel.win.size)}` }
        : { href: RELEASES_PAGE, title: 'Download for Windows', sub: '64-bit · beta' },
      macOther: macOther ? { href: macOther.url, label: `${macKind(macOther)} Mac? Get that version` } : null
    };
    const version = rel && rel.version ? ` Version ${rel.version}.` : '';
    const osNote = soon ? 'The first release is almost here. On GitHub, pick Watch › Custom › Releases to hear when it’s out.'
      : !s.osKnown ? ''
      : s.os === 'mobile' ? 'Phosphor runs on Mac and Windows computers.'
      : mac ? `Looks like you’re on a Mac.${version}`
      : win ? `Looks like you’re on Windows.${version}`
      : 'Phosphor runs on macOS and Windows.';
    const canShare = typeof navigator !== 'undefined' && !!navigator.share;

    const PH = [
      { name: 'Brief', line: 'Say what you’re making in a sentence. It asks only the questions that matter.' },
      { name: 'Shape', line: 'It works out the plan from your footage and shows its progress and decisions.' },
      { name: 'Build', line: 'It cuts the video and publishes a playable version early.' },
      { name: 'Check', line: 'Every export is checked before you’re asked to approve it.' },
      { name: 'Review', line: 'Watch the cut, leave timestamped notes, send a round. It revises until it’s right.' }
    ];

    const clipT = (i) => ({ op: s.clips > i ? 1 : 0, tf: s.clips > i ? 'scaleX(1)' : 'scaleX(0)' });
    const mk = (arr, start) => arr.map(([l, w], j) => ({ left: l + '%', width: w + '%', ...clipT(start + j) }));

    const pill = s.mStep === 1 ? { t: 'Question', bg: '#e7b86a', fg: '#3b2d43', scr: '#e7b86a' }
      : s.mStep === 4 ? { t: 'Ready', bg: '#2f6b5e', fg: '#fffdf8', scr: '#b7a4d6' }
      : { t: 'Working', bg: '#7fb7a8', fg: '#3b2d43', scr: '#7fb7a8' };
    const msgs = ['Building the first cut from your footage…', 'One quick question before I go on.', 'First cut is up. Watch it and leave notes.', 'Round 1 received. Revising and checking…', 'v2 is ready and checked. Approve when you’re happy.'];
    const NOTES = [{ t: '00:04', text: 'Trim the pause before the title.' }, { t: '00:11', text: 'Hold on the screen a beat longer.' }, { t: '00:19', text: 'Music a little lower here.' }];

    const spread = s.spread || s.hover;
    const CARDS = [
      { tag: 'from reference videos', title: 'Styles', line: 'Learned from videos you point it at, then reused on every project.', band: '#b7a4d6', radius: '10px', shapeTf: 'rotate(-6deg)' },
      { tag: 'your assets', title: 'Asset kits', line: 'The pieces your videos keep coming back to, ready to go.', band: '#e7b86a', radius: '50%', shapeTf: 'none' },
      { tag: 'drop-in', title: 'Effects', line: 'Reusable effects you can bring into the next video.', band: '#7fb7a8', radius: '8px', shapeTf: 'rotate(45deg)' }
    ];
    const pos = spread ? [['-310px', '20px', '-5deg'], ['0px', '-6px', '0deg'], ['310px', '20px', '5deg']] : [['-26px', '14px', '-9deg'], ['0px', '0px', '0deg'], ['26px', '14px', '9deg']];

    const CHECK = [
      'macOS 13 or later (Apple silicon or Intel), or 64-bit Windows',
      'Python 3.11 or newer',
      'FFmpeg',
      'The Codex or Claude Code CLI, signed in with your account'
    ];

    const k = s.crewStep == null ? 7 : s.crewStep;
    const IDS = ['director', 'research', 'story', 'picture', 'graphics', 'sound', 'qc'];
    const NAMES = ['Director', 'Research & Assets', 'Story & Timing', 'Picture Edit', 'Graphics & Motion', 'Sound', 'Quality Check'];
    const ACT = ['Reading your brief', 'Gathering assets', 'Planning the story', 'Cutting footage', 'Adding titles', 'Mixing sound', 'Checking the cut'];
    const act = k >= 7 ? 0 : k;
    const cv = {}, cr = {};
    IDS.forEach((id, i) => {
      const active = i === act && k >= 0, done = k > i;
      const st = done ? 'done' : active ? 'working' : 'idle';
      cv[id + 'S'] = st === 'idle' ? '#b7a4d6' : '#7fb7a8';
      cv[id + 'G'] = st === 'done' ? '✓' : '';
      cv[id + 'F'] = st === 'done' ? 0 : .7;
      cr[id + 'Bg'] = active ? '#fffdf8' : 'transparent';
      cr[id + 'Bd'] = active ? '#3b2d43' : 'transparent';
      cr[id + 'Sh'] = active ? '2px 2px 0 #3b2d43' : 'none';
      cr[id + 'Sub'] = active ? (k >= 7 ? 'Ready for review' : ACT[i]) : done ? 'Done' : 'Waiting';
      cr[id + 'SubC'] = active ? '#2f6b5e' : '#6b5d76';
    });
    const glowC = ['#b7a4d6', '#e7b86a', '#b7a4d6', '#7fb7a8', '#e7b86a', '#7fb7a8', '#7fb7a8', '#e7b86a'][Math.max(0, k)];
    const on = (c, a = '1', b = '0') => c ? a : b;
    const hv = {
      glow: `0 0 0 3px #fffdf8, 0 0 ${k >= 0 ? 46 : 20}px ${glowC}`,
      empty: on(k < 1), brief: on(k >= 0 && k <= 1), briefTf: on(k >= 0 && k <= 1, 'translateY(0) scale(1)', 'translateY(-12px) scale(.9)'),
      assets: on(k === 1), assetsTf: on(k === 1, 'translateY(0) scale(1)', 'translateY(20px) scale(.4)'),
      story: on(k === 2), foot: on(k >= 3), footTf: on(k >= 3, 'scale(1)', 'scale(1.12)'),
      gfx: on(k >= 4), gfxTf: on(k >= 4, 'rotate(-4deg) scale(1)', 'rotate(-14deg) scale(.3)'), lowerTf: on(k >= 4, 'translateX(0)', 'translateX(-110%)'),
      snd: on(k >= 5), qc: on(k === 6), badge: on(k >= 6), badgeText: k >= 7 ? '✓ checked' : 'checking…', badgeBg: k >= 7 ? '#7fb7a8' : '#fffdf8', ready: on(k >= 7)
    };

    // Timeline clips. Hiding fades first, then resets the clip/scale once invisible.
    const reveal = (show, delay, dur, ease) => show
      ? { op: 1, clip: 'inset(0 0 0 0)', tr: `opacity .15s ease ${delay}ms,clip-path ${dur}ms ${ease} ${delay}ms` }
      : { op: 0, clip: 'inset(0 100% 0 0)', tr: 'opacity .3s ease,clip-path 0s linear .3s' };
    const pop = (show, delay) => show
      ? { op: 1, tf: 'scale(1)', tr: `opacity .2s ease ${delay}ms,transform .5s cubic-bezier(.2,1.5,.4,1) ${delay}ms` }
      : { op: 0, tf: 'scale(.4)', tr: 'opacity .3s ease,transform 0s linear .3s' };
    const cut = c => ({ ...c, ...reveal(k >= 3, c.l * PIC_MS / 100, (c.r - c.l) * PIC_MS / 100, 'linear') });
    const playing = s.crewStep != null && k >= 6;
    const tl = {
      marks: MARKS.map((m, i) => ({ ...m, ...pop(k >= 2, i * 220) })),
      v2: TITLES.map((c, i) => ({ ...c, ...pop(k >= 4, i * 260) })),
      v1: CUTS.map(cut), a1: CUTS.map(cut),
      a2: { ...MUSIC, ...reveal(k >= 5, 0, 800, 'cubic-bezier(.3,.7,.3,1)') },
      checkOp: k >= 3 ? 1 : 0,
      playOp: playing ? 0 : 1, pauseOp: playing ? 1 : 0,
      specDisp: s.narrow ? 'none' : 'inline'
    };

    return {
      rootRef: this.rootRef, logoRef: this.logoRef, heroRef: this.heroRef, glowRef: this.glowRef,
      phasesRef: this.phasesRef, lineRef: this.lineRef, fillRef: this.fillRef, beadRef: this.beadRef,
      mockRef: this.mockRef, burstRef: this.burstRef, tcRef: this.tcRef, tlRef: this.tlRef, playheadRef: this.playheadRef,
      controlRef: this.controlRef, knobRef: this.knobRef, cursorRef: this.cursorRef, stopRef: this.stopRef,
      deckRef: this.deckRef, localRef: this.localRef, miniEyesRef: this.miniEyesRef, shackleRef: this.shackleRef, checkRef: this.checkRef,
      stageRef: this.stageRef, videoRef: this.videoRef, tlHeadRef: this.tlHeadRef, tlCheckRef: this.tlCheckRef, tlTcRef: this.tlTcRef, tl,

      wide: !s.narrow, narrow: s.narrow,
      cv, cr, hv,
      crewGrid: s.narrow ? 'minmax(0,1fr)' : '214px auto',
      crewCols: s.narrow ? 'repeat(7,minmax(0,1fr))' : 'minmax(0,1fr)',
      crewLabelDisp: s.narrow ? 'none' : 'flex', crewRowPad: s.narrow ? '4px' : '5px 10px 5px 6px', crewJustify: s.narrow ? 'center' : 'flex-start',
      crewDot: k >= 7 ? '#e7b86a' : k < 0 ? '#b7a4d6' : '#7fb7a8',
      crewCaption: k < 0 ? 'Waiting for your footage' : k >= 7 ? 'Director · Ready for your review' : NAMES[k] + ' · ' + ACT[k],

      logoPixels: this.pixels('#b7a4d6'), footPixels: this.pixels('#b7a4d6'),
      year: String(new Date().getFullYear()),

      macBg: mac ? primary.bg : secondary.bg, macShadow: mac ? primary.sh : secondary.sh,
      winBg: win ? primary.bg : secondary.bg, winShadow: win ? primary.sh : secondary.sh,
      dl, osNote,
      showShare: s.os === 'mobile', share: this.shareLink,
      shareLabel: s.copied ? 'Link copied' : canShare ? 'Send yourself the link' : 'Copy the link',

      exVideoRef: this.exVideoRef, exBarRef: this.exBarRef,
      exToggle: this.exToggle, exSound: this.exSound, exWatch: this.exWatch,
      exPlaying: s.exPlaying, exPlayOp: s.exPlaying ? 0 : 1, exMuted: s.exMuted, exSoundLabel: s.exMuted ? 'Sound on' : 'Mute',
      faq: FAQ,

      phaseNodes: PH.map((p, i) => ({ num: String(i + 1), name: p.name, bg: i === s.phase ? '#e7b86a' : i < s.phase ? '#7fb7a8' : '#fffdf8', fg: i <= s.phase ? '#3b2d43' : '#5b4d66' })),
      // One illustration whose pieces move between phases; the number and heading roll, the copy slides.
      phaseMorph: morphPieces(s.phase),
      phaseNumTf: `translateY(-${(s.phase * 1.3).toFixed(2)}em)`,
      phaseNameTf: `translateY(-${(s.phase * 1.15).toFixed(2)}em)`,
      phaseCopy: PH.map((p, i) => i === s.phase
        ? { ...p, op: 1, tf: 'none', pe: 'auto', tr: 'opacity .4s ease .2s,transform .6s cubic-bezier(.76,0,.24,1) .1s' }
        : { ...p, op: 0, tf: `translateY(${i < s.phase ? -14 : 14}px)`, pe: 'none', tr: 'opacity .2s ease,transform .6s cubic-bezier(.76,0,.24,1)' }),

      mockScreen: pill.scr, pillBg: pill.bg, pillFg: pill.fg, pillText: pill.t,
      agentMsg: msgs[s.mStep],
      qOp: s.mStep === 1 ? 1 : .35, qTf: s.mStep === 1 ? 'scale(1)' : 'scale(.97)',
      keepBg: s.answered ? '#e7b86a' : '#fffdf8',
      notes: NOTES.map((n, i) => ({ ...n, op: s.notes > i ? 1 : 0, tf: s.notes > i ? 'translateY(0) scale(1)' : 'translateY(10px) scale(.9)' })),
      readyOp: s.mStep === 4 ? 1 : 0,
      clipsV1: mk([[0, 18], [19, 14], [34, 22], [57, 16], [74, 26]], 0),
      clipsV2: mk([[8, 10], [40, 13], [78, 12]], 5),
      clipsA1: mk([[0, 63], [64, 36]], 8),

      controlSub: s.controlOn ? 'On. The agent can use your pointer and keyboard.' : 'Off until you switch it on.',
      controlAria: s.controlOn ? 'true' : 'false',
      onLayerOp: s.controlOn ? 1 : 0, knobTf: s.controlOn ? 'translateX(32px)' : 'translateX(0)',
      cursorOp: s.controlOn ? 1 : 0, screenTag: s.controlOn ? 'agent driving' : 'you’re driving',
      handedOp: s.handed ? 1 : 0,
      keys: mac ? ['⌘', '⌥', '⇧', 'S'] : ['Ctrl', 'Alt', 'Shift', 'S'],
      toggleControl: () => this.setState(p => ({ controlOn: !p.controlOn, handed: false })),
      stopNow: () => {
        if (!this.reduced && this.stopRef.current) this.stopRef.current.animate([{ transform: 'scale(1)' }, { transform: 'scale(.94,.9)', offset: .3 }, { transform: 'scale(1.03)', offset: .65 }, { transform: 'scale(1)' }], { duration: 420 });
        this.setState({ controlOn: false, handed: true });
        clearTimeout(this.handT); this.handT = setTimeout(() => this.setState({ handed: false }), 3200);
      },

      cards: CARDS.map((c, i) => ({ ...c, z: i === 1 ? 3 : 2 - (i === 0 ? 0 : 1) + 1, tf: `translate(${pos[i][0]},${pos[i][1]}) rotate(${pos[i][2]})` })),
      deckEnter: () => this.setState({ hover: true }), deckLeave: () => this.setState({ hover: false }),

      checklist: CHECK.map((t, i) => ({ t, op: s.ticks > i ? 1 : 0, tf: s.ticks > i ? 'rotate(45deg) scale(1)' : 'rotate(45deg) scale(0)' }))
    };
  }

  render() {
    const v = this.renderVals();
    return (
      <div ref={v.rootRef} id="top" style={css(`position:relative;min-height:100vh;background:#f4efe6`)}>

      <a href="#main" style={css(`position:absolute;left:-9999px;top:8px;z-index:100;padding:8px 14px;background:#fffdf8;border:2px solid #3b2d43;border-radius:10px;color:#3b2d43`)} className="skip-link">Skip to content</a>

      <nav aria-label="Main" style={css(`position:sticky;top:0;z-index:50;background:rgba(244,239,230,.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:2px solid #3b2d43`)}>
        <div style={css(`max-width:1180px;margin:0 auto;padding:10px 24px;display:flex;align-items:center;gap:28px`)}>
          <a href="#top" aria-label="Phosphor home" style={css(`display:flex;align-items:center;gap:12px;text-decoration:none;color:#3b2d43`)}>
            <span ref={v.logoRef} aria-hidden="true" style={css(`display:grid;grid-template-columns:repeat(12,4px);grid-auto-rows:4px`)}>
              {v.logoPixels.map((p, _p) => (<React.Fragment key={_p}><span style={css(`background:${p.c}`)}></span></React.Fragment>))}
            </span>
            <span style={css(`font:800 26px/1 'Baloo 2',sans-serif;letter-spacing:-.02em;padding-top:3px`)}>Phosphor</span>
          </a>
          {v.wide && (<>
            <div className="nav-links" style={css(`display:flex;gap:22px;font:600 16px 'Baloo 2',sans-serif`)}>
              <a href="#how" style={css(`color:#5b4d66;text-decoration:none`)} className="nav-link">How it works</a>
              <a href="#watch" style={css(`color:#5b4d66;text-decoration:none`)} className="nav-link">Watch it work</a>
              <a href="#example" style={css(`color:#5b4d66;text-decoration:none`)} className="nav-link">Example</a>
              <a href="#control" style={css(`color:#5b4d66;text-decoration:none`)} className="nav-link">Control</a>
              <a href="#private" style={css(`color:#5b4d66;text-decoration:none`)} className="nav-link">Private</a>
            </div>
          </>)}
          <a href="#get-started" style={css(`margin-left:auto;display:inline-flex;align-items:center;min-height:40px;padding:6px 16px;border:2px solid #3b2d43;border-radius:11px;background:#fffdf8;box-shadow:2px 2px 0 #3b2d43;color:#3b2d43;text-decoration:none;font:800 15px 'Baloo 2',sans-serif;transition:transform .15s,box-shadow .15s`)} className="nav-cta">Download</a>
        </div>
      </nav>

      <main id="main">

      <section ref={v.heroRef} aria-labelledby="hero-title" style={css(`position:relative;overflow:hidden;border-bottom:2px solid #3b2d43;background:radial-gradient(circle at 1px 1px, rgba(59,45,67,.09) 1px, transparent 1.5px) 0 0/22px 22px, #f4efe6`)}>
        <div ref={v.glowRef} aria-hidden="true" style={css(`position:absolute;left:0;top:0;width:640px;height:640px;border-radius:50%;background:radial-gradient(closest-side, rgba(183,164,214,.55), rgba(183,164,214,.18) 55%, transparent);pointer-events:none;will-change:transform;transform:translate3d(55vw,80px,0)`)}></div>
        <div aria-hidden="true" style={css(`position:absolute;inset:0;pointer-events:none`)}>
          <span data-parallax="0.25" style={css(`position:absolute;left:6%;top:18%`)}><span data-drift="" style={css(`display:block;width:14px;height:14px;background:#b7a4d6;border:2px solid #3b2d43`)}></span></span>
          <span data-parallax="0.45" style={css(`position:absolute;left:44%;top:9%`)}><span data-drift="" style={css(`display:block;width:10px;height:10px;background:#7fb7a8;border:2px solid #3b2d43`)}></span></span>
          <span data-parallax="0.15" style={css(`position:absolute;left:52%;bottom:14%`)}><span data-drift="" style={css(`display:block;width:18px;height:18px;background:#e7b86a;border:2px solid #3b2d43`)}></span></span>
          <span data-parallax="0.35" style={css(`position:absolute;right:5%;top:12%`)}><span data-drift="" style={css(`display:block;width:12px;height:12px;background:#a3405c;border:2px solid #3b2d43`)}></span></span>
          <span data-parallax="0.3" style={css(`position:absolute;right:9%;bottom:10%`)}><span data-drift="" style={css(`display:block;width:10px;height:10px;background:#b7a4d6;border:2px solid #3b2d43`)}></span></span>
          <span data-parallax="0.5" style={css(`position:absolute;left:3%;bottom:20%`)}><span data-drift="" style={css(`display:block;width:8px;height:8px;background:#7fb7a8;border:2px solid #3b2d43`)}></span></span>
        </div>
        <div style={css(`position:relative;max-width:1180px;margin:0 auto;padding:clamp(48px,8vw,96px) 24px clamp(56px,8vw,104px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:clamp(40px,6vw,72px);align-items:center`)}>
          <div style={css(`display:flex;flex-direction:column;gap:24px;min-width:0`)}>
            <div data-reveal="0" style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#5b4d66`)}>
              <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
              <span>A desktop app for macOS and Windows</span>
            </div>
            <h1 id="hero-title" data-reveal="80" style={css(`margin:0;font:800 clamp(46px,7.2vw,88px)/.95 'Baloo 2',sans-serif;letter-spacing:-.03em;text-wrap:balance`)}>Your AI editing crew, on your own computer.</h1>
            <p data-reveal="160" style={css(`margin:0;font-size:clamp(18px,2vw,21px);line-height:1.5;color:#5b4d66;max-width:36ch;text-wrap:pretty`)}>Pick your footage and say in a sentence what you're making. Phosphor's agent turns it into a short you can watch, note and approve.</p>
            <div data-reveal="240">{this.downloads(v)}</div>
            <p data-reveal="320" style={css(`margin:0;font-size:14px;line-height:1.55;color:#5b4d66;max-width:56ch;padding-top:14px;border-top:2px dashed #b7a4d6`)}>macOS 13 or later (Apple silicon or Intel), or 64-bit Windows. You also need Python 3.11+, FFmpeg, and the Codex or Claude Code CLI. The app checks for these and tells you what's missing.</p>
          </div>

          <div data-parallax="-0.08" data-parallax-max="48" style={css(`display:flex;flex-direction:column;align-items:center;gap:28px;min-width:0`)}>


            <div ref={v.stageRef} aria-hidden="true" style={css(`position:relative;width:100%;max-width:580px;display:grid;grid-template-columns:${v.crewGrid};gap:22px;align-items:center`)}>
              <div style={css(`display:grid;grid-template-columns:${v.crewCols};gap:6px;min-width:0`)}>
                <div style={css(`display:flex;align-items:center;justify-content:${v.crewJustify};gap:10px;padding:${v.crewRowPad};border:2px solid ${v.cr.directorBd};border-radius:12px;background:${v.cr.directorBg};box-shadow:${v.cr.directorSh};transition:background .3s,border-color .3s,box-shadow .3s;min-width:0`)}>
                  <div data-crew-av="director" style={css(`width:min(38px,100%);flex:none;transform-origin:50% 100%`)}>
                    <svg viewBox="0 0 64 64" style={css(`display:block;width:100%;height:auto;overflow:visible;color:#3b2d43`)}>
                      <defs><clipPath id="cr-director"><rect x="15" y="29" width="34" height="23" rx="3"></rect></clipPath></defs>
                      <g fill="currentColor"><rect x="8" y="22" width="48" height="38" rx="8"></rect><g transform="rotate(-12 31 11)"><rect x="7" y="7" width="49" height="10" rx="3"></rect><path d="M14 8 11 16M26 8 23 16M38 8 35 16M50 8 47 16" stroke="#fffdf8" strokeWidth="5"></path></g></g>
                      <g clipPath="url(#cr-director)">
                        <rect x="15" y="29" width="34" height="23" style={css(`fill:${v.cv.directorS};transition:fill .35s`)}></rect>
                        <g style={css(`opacity:${v.cv.directorF};transition:opacity .2s`)}><circle cx="29" cy="40.5" r="1.3" fill="#3b2d43"></circle><circle cx="35" cy="40.5" r="1.3" fill="#3b2d43"></circle><path d="M30 44.5q2 1 4 0" fill="none" stroke="#3b2d43" strokeWidth=".9"></path></g>
                        <text x="32" y="41" dominantBaseline="middle" textAnchor="middle" fontSize="18" style={css(`font-family:'Baloo 2',sans-serif;font-weight:800;fill:#3b2d43`)}>{v.cv.directorG}</text>
                      </g>
                    </svg>
                  </div>
                  <div style={css(`display:${v.crewLabelDisp};flex-direction:column;gap:1px;min-width:0`)}>
                    <span style={css(`font:700 15px/1.15 'Baloo 2',sans-serif;white-space:nowrap`)}>Director</span>
                    <span style={css(`font:500 11px/1.3 'Fira Code',monospace;color:${v.cr.directorSubC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{v.cr.directorSub}</span>
                  </div>
                </div>
                <div style={css(`display:flex;align-items:center;justify-content:${v.crewJustify};gap:10px;padding:${v.crewRowPad};border:2px solid ${v.cr.researchBd};border-radius:12px;background:${v.cr.researchBg};box-shadow:${v.cr.researchSh};transition:background .3s,border-color .3s,box-shadow .3s;min-width:0`)}>
                  <div data-crew-av="research" style={css(`width:min(38px,100%);flex:none;transform-origin:50% 100%`)}>
                    <svg viewBox="0 0 64 64" style={css(`display:block;width:100%;height:auto;overflow:visible;color:#3b2d43`)}>
                      <defs><clipPath id="cr-research"><rect x="12" y="13" width="32" height="32" rx="16"></rect></clipPath></defs>
                      <g fill="currentColor"><path d="m42 44 14 14" stroke="currentColor" strokeWidth="11" strokeLinecap="round"></path><circle cx="28" cy="29" r="23"></circle></g>
                      <g clipPath="url(#cr-research)">
                        <rect x="12" y="13" width="32" height="32" style={css(`fill:${v.cv.researchS};transition:fill .35s`)}></rect>
                        <g style={css(`opacity:${v.cv.researchF};transition:opacity .2s`)}><circle cx="25" cy="29" r="1.3" fill="#3b2d43"></circle><circle cx="31" cy="29" r="1.3" fill="#3b2d43"></circle><path d="M26 33q2 1 4 0" fill="none" stroke="#3b2d43" strokeWidth=".9"></path></g>
                        <text x="28" y="29.5" dominantBaseline="middle" textAnchor="middle" fontSize="18" style={css(`font-family:'Baloo 2',sans-serif;font-weight:800;fill:#3b2d43`)}>{v.cv.researchG}</text>
                      </g>
                    </svg>
                  </div>
                  <div style={css(`display:${v.crewLabelDisp};flex-direction:column;gap:1px;min-width:0`)}>
                    <span style={css(`font:700 15px/1.15 'Baloo 2',sans-serif;white-space:nowrap`)}>Research &amp; Assets</span>
                    <span style={css(`font:500 11px/1.3 'Fira Code',monospace;color:${v.cr.researchSubC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{v.cr.researchSub}</span>
                  </div>
                </div>
                <div style={css(`display:flex;align-items:center;justify-content:${v.crewJustify};gap:10px;padding:${v.crewRowPad};border:2px solid ${v.cr.storyBd};border-radius:12px;background:${v.cr.storyBg};box-shadow:${v.cr.storySh};transition:background .3s,border-color .3s,box-shadow .3s;min-width:0`)}>
                  <div data-crew-av="story" style={css(`width:min(38px,100%);flex:none;transform-origin:50% 100%`)}>
                    <svg viewBox="0 0 64 64" style={css(`display:block;width:100%;height:auto;overflow:visible;color:#3b2d43`)}>
                      <defs><clipPath id="cr-story"><rect x="15" y="21" width="34" height="34" rx="17"></rect></clipPath></defs>
                      <g fill="currentColor"><rect x="27" y="3" width="11" height="9" rx="2"></rect><circle cx="32" cy="37" r="25"></circle></g>
                      <g clipPath="url(#cr-story)">
                        <rect x="15" y="21" width="34" height="34" style={css(`fill:${v.cv.storyS};transition:fill .35s`)}></rect>
                        <g style={css(`opacity:${v.cv.storyF};transition:opacity .2s`)}><circle cx="29" cy="38" r="1.3" fill="#3b2d43"></circle><circle cx="35" cy="38" r="1.3" fill="#3b2d43"></circle><path d="M30 42q2 1 4 0" fill="none" stroke="#3b2d43" strokeWidth=".9"></path></g>
                        <text x="32" y="38.5" dominantBaseline="middle" textAnchor="middle" fontSize="18" style={css(`font-family:'Baloo 2',sans-serif;font-weight:800;fill:#3b2d43`)}>{v.cv.storyG}</text>
                      </g>
                    </svg>
                  </div>
                  <div style={css(`display:${v.crewLabelDisp};flex-direction:column;gap:1px;min-width:0`)}>
                    <span style={css(`font:700 15px/1.15 'Baloo 2',sans-serif;white-space:nowrap`)}>Story &amp; Timing</span>
                    <span style={css(`font:500 11px/1.3 'Fira Code',monospace;color:${v.cr.storySubC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{v.cr.storySub}</span>
                  </div>
                </div>
                <div style={css(`display:flex;align-items:center;justify-content:${v.crewJustify};gap:10px;padding:${v.crewRowPad};border:2px solid ${v.cr.pictureBd};border-radius:12px;background:${v.cr.pictureBg};box-shadow:${v.cr.pictureSh};transition:background .3s,border-color .3s,box-shadow .3s;min-width:0`)}>
                  <div data-crew-av="picture" style={css(`width:min(38px,100%);flex:none;transform-origin:50% 100%`)}>
                    <svg viewBox="0 0 64 64" style={css(`display:block;width:100%;height:auto;overflow:visible;color:#3b2d43`)}>
                      <defs><clipPath id="cr-picture"><rect x="22" y="27" width="26" height="26" rx="13"></rect></clipPath></defs>
                      <g fill="currentColor"><rect x="4" y="19" width="57" height="41" rx="9"></rect><rect x="10" y="10" width="16" height="14" rx="4"></rect><rect x="47" y="13" width="9" height="6" rx="2" fill="#e7b86a" stroke="currentColor"></rect><circle cx="35" cy="40" r="18" fill="none" stroke="#b7a4d6" strokeWidth="1.5"></circle></g>
                      <g clipPath="url(#cr-picture)">
                        <rect x="22" y="27" width="26" height="26" style={css(`fill:${v.cv.pictureS};transition:fill .35s`)}></rect>
                        <g style={css(`opacity:${v.cv.pictureF};transition:opacity .2s`)}><circle cx="32" cy="40" r="1.3" fill="#3b2d43"></circle><circle cx="38" cy="40" r="1.3" fill="#3b2d43"></circle><path d="M33 44q2 1 4 0" fill="none" stroke="#3b2d43" strokeWidth=".9"></path></g>
                        <text x="35" y="40.5" dominantBaseline="middle" textAnchor="middle" fontSize="18" style={css(`font-family:'Baloo 2',sans-serif;font-weight:800;fill:#3b2d43`)}>{v.cv.pictureG}</text>
                      </g>
                    </svg>
                  </div>
                  <div style={css(`display:${v.crewLabelDisp};flex-direction:column;gap:1px;min-width:0`)}>
                    <span style={css(`font:700 15px/1.15 'Baloo 2',sans-serif;white-space:nowrap`)}>Picture Edit</span>
                    <span style={css(`font:500 11px/1.3 'Fira Code',monospace;color:${v.cr.pictureSubC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{v.cr.pictureSub}</span>
                  </div>
                </div>
                <div style={css(`display:flex;align-items:center;justify-content:${v.crewJustify};gap:10px;padding:${v.crewRowPad};border:2px solid ${v.cr.graphicsBd};border-radius:12px;background:${v.cr.graphicsBg};box-shadow:${v.cr.graphicsSh};transition:background .3s,border-color .3s,box-shadow .3s;min-width:0`)}>
                  <div data-crew-av="graphics" style={css(`width:min(38px,100%);flex:none;transform-origin:50% 100%`)}>
                    <svg viewBox="0 0 64 64" style={css(`display:block;width:100%;height:auto;overflow:visible;color:#3b2d43`)}>
                      <defs><clipPath id="cr-graphics"><rect x="20" y="25" width="28" height="22" rx="3"></rect></clipPath></defs>
                      <g fill="currentColor"><path d="M33 10C12 8 4 19 4 35c0 18 14 24 32 24 19 0 27-11 27-25C63 19 50 10 33 10Z"></path><circle cx="14" cy="19" r="3.5" fill="#e7b86a"></circle><circle cx="24" cy="15" r="3.5" fill="#a3405c"></circle><circle cx="51" cy="48" r="5.5" fill="#f4efe6"></circle></g>
                      <g clipPath="url(#cr-graphics)">
                        <rect x="20" y="25" width="28" height="22" style={css(`fill:${v.cv.graphicsS};transition:fill .35s`)}></rect>
                        <g style={css(`opacity:${v.cv.graphicsF};transition:opacity .2s`)}><circle cx="31" cy="36" r="1.3" fill="#3b2d43"></circle><circle cx="37" cy="36" r="1.3" fill="#3b2d43"></circle><path d="M32 40q2 1 4 0" fill="none" stroke="#3b2d43" strokeWidth=".9"></path></g>
                        <text x="34" y="36.5" dominantBaseline="middle" textAnchor="middle" fontSize="18" style={css(`font-family:'Baloo 2',sans-serif;font-weight:800;fill:#3b2d43`)}>{v.cv.graphicsG}</text>
                      </g>
                    </svg>
                  </div>
                  <div style={css(`display:${v.crewLabelDisp};flex-direction:column;gap:1px;min-width:0`)}>
                    <span style={css(`font:700 15px/1.15 'Baloo 2',sans-serif;white-space:nowrap`)}>Graphics &amp; Motion</span>
                    <span style={css(`font:500 11px/1.3 'Fira Code',monospace;color:${v.cr.graphicsSubC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{v.cr.graphicsSub}</span>
                  </div>
                </div>
                <div style={css(`display:flex;align-items:center;justify-content:${v.crewJustify};gap:10px;padding:${v.crewRowPad};border:2px solid ${v.cr.soundBd};border-radius:12px;background:${v.cr.soundBg};box-shadow:${v.cr.soundSh};transition:background .3s,border-color .3s,box-shadow .3s;min-width:0`)}>
                  <div data-crew-av="sound" style={css(`width:min(38px,100%);flex:none;transform-origin:50% 100%`)}>
                    <svg viewBox="0 0 64 64" style={css(`display:block;width:100%;height:auto;overflow:visible;color:#3b2d43`)}>
                      <defs><clipPath id="cr-sound"><rect x="25" y="30" width="17" height="18" rx="3"></rect></clipPath></defs>
                      <g fill="currentColor"><path d="M18 24V16q0-6 6-6h17q6 0 6 6v8" fill="none" stroke="currentColor" strokeWidth="1.6"></path><rect x="2" y="22" width="60" height="35" rx="8"></rect><circle cx="13" cy="39" r="7" fill="#5b4d66" stroke="#b7a4d6"></circle><circle cx="53" cy="39" r="7" fill="#5b4d66" stroke="#b7a4d6"></circle></g>
                      <g clipPath="url(#cr-sound)">
                        <rect x="25" y="30" width="17" height="18" style={css(`fill:${v.cv.soundS};transition:fill .35s`)}></rect>
                        <g style={css(`opacity:${v.cv.soundF};transition:opacity .2s`)}><circle cx="30.5" cy="39" r="1.3" fill="#3b2d43"></circle><circle cx="36.5" cy="39" r="1.3" fill="#3b2d43"></circle><path d="M31.5 43q2 1 4 0" fill="none" stroke="#3b2d43" strokeWidth=".9"></path></g>
                        <text x="33.5" y="39.5" dominantBaseline="middle" textAnchor="middle" fontSize="15" style={css(`font-family:'Baloo 2',sans-serif;font-weight:800;fill:#3b2d43`)}>{v.cv.soundG}</text>
                      </g>
                    </svg>
                  </div>
                  <div style={css(`display:${v.crewLabelDisp};flex-direction:column;gap:1px;min-width:0`)}>
                    <span style={css(`font:700 15px/1.15 'Baloo 2',sans-serif;white-space:nowrap`)}>Sound</span>
                    <span style={css(`font:500 11px/1.3 'Fira Code',monospace;color:${v.cr.soundSubC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{v.cr.soundSub}</span>
                  </div>
                </div>
                <div style={css(`display:flex;align-items:center;justify-content:${v.crewJustify};gap:10px;padding:${v.crewRowPad};border:2px solid ${v.cr.qcBd};border-radius:12px;background:${v.cr.qcBg};box-shadow:${v.cr.qcSh};transition:background .3s,border-color .3s,box-shadow .3s;min-width:0`)}>
                  <div data-crew-av="qc" style={css(`width:min(38px,100%);flex:none;transform-origin:50% 100%`)}>
                    <svg viewBox="0 0 64 64" style={css(`display:block;width:100%;height:auto;overflow:visible;color:#3b2d43`)}>
                      <defs><clipPath id="cr-qc"><rect x="17" y="24" width="30" height="21" rx="3"></rect></clipPath></defs>
                      <g fill="currentColor"><rect x="10" y="11" width="44" height="50" rx="6"></rect><rect x="22" y="5" width="21" height="12" rx="3"></rect><path d="M29 9h8" stroke="#7fb7a8" strokeWidth="3" strokeLinecap="round"></path><path d="M17 50h30M17 54h30" stroke="#b7a4d6" strokeWidth="1.5"></path></g>
                      <g clipPath="url(#cr-qc)">
                        <rect x="17" y="24" width="30" height="21" style={css(`fill:${v.cv.qcS};transition:fill .35s`)}></rect>
                        <g style={css(`opacity:${v.cv.qcF};transition:opacity .2s`)}><circle cx="29" cy="34.5" r="1.3" fill="#3b2d43"></circle><circle cx="35" cy="34.5" r="1.3" fill="#3b2d43"></circle><path d="M30 38.5q2 1 4 0" fill="none" stroke="#3b2d43" strokeWidth=".9"></path></g>
                        <text x="32" y="35" dominantBaseline="middle" textAnchor="middle" fontSize="18" style={css(`font-family:'Baloo 2',sans-serif;font-weight:800;fill:#3b2d43`)}>{v.cv.qcG}</text>
                      </g>
                    </svg>
                  </div>
                  <div style={css(`display:${v.crewLabelDisp};flex-direction:column;gap:1px;min-width:0`)}>
                    <span style={css(`font:700 15px/1.15 'Baloo 2',sans-serif;white-space:nowrap`)}>Quality Check</span>
                    <span style={css(`font:500 11px/1.3 'Fira Code',monospace;color:${v.cr.qcSubC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{v.cr.qcSub}</span>
                  </div>
                </div>
              </div>
              <div style={css(`display:flex;flex-direction:column;align-items:center;gap:14px;min-width:0`)}>
                <div ref={v.videoRef} style={css(`position:relative;width:min(250px,64vw,100%);aspect-ratio:9/16;border-radius:18px;overflow:hidden;background:#3b2d43;border:3px solid #3b2d43;box-shadow:${v.hv.glow};transition:box-shadow .5s`)}>
                  <span style={css(`position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(183,164,214,.25),transparent 70%)`)}></span>
                  <span style={css(`position:absolute;left:0;right:0;top:46%;text-align:center;font:500 12px 'Fira Code',monospace;color:#b7a4d6;opacity:${v.hv.empty};transition:opacity .3s`)}>no cut yet</span>
                  <div style={css(`position:absolute;inset:0;opacity:${v.hv.foot};transform:${v.hv.footTf};transition:opacity .5s,transform .8s cubic-bezier(.2,.8,.2,1)`)}>
                    <span style={css(`position:absolute;inset:0;background:repeating-linear-gradient(135deg,#c6b7df 0 10px,#b7a4d6 10px 20px)`)}></span>
                    <span data-v="shotB" style={css(`position:absolute;inset:0;background:repeating-linear-gradient(45deg,#a8d0c5 0 10px,#7fb7a8 10px 20px);opacity:0`)}></span>
                    <span style={css(`position:absolute;left:34%;top:30%;width:32%;aspect-ratio:1;border-radius:50%;background:#efe7d9;border:3px solid #3b2d43`)}></span>
                    <span style={css(`position:absolute;left:20%;top:52%;width:60%;height:40%;border-radius:40% 40% 8px 8px;background:#6f5a9a;border:3px solid #3b2d43`)}></span>
                    <span style={css(`position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(59,45,67,.1) 3px 4px)`)}></span>
                  </div>
                  <div style={css(`position:absolute;left:8%;right:8%;top:8%;padding:9px 11px;border:2px solid #3b2d43;border-radius:12px 12px 12px 3px;background:#fffdf8;font-size:13px;line-height:1.35;color:#3b2d43;opacity:${v.hv.brief};transform:${v.hv.briefTf};transition:opacity .3s,transform .45s cubic-bezier(.2,1.4,.4,1)`)}>A 40-second short from today's recording.</div>
                  <div style={css(`position:absolute;left:10%;right:10%;top:38%;display:flex;justify-content:space-between`)}>
                    <span style={css(`width:26%;aspect-ratio:1;border:2px solid #3b2d43;border-radius:7px;background:repeating-linear-gradient(135deg,#b7a4d6 0 5px,#fffdf8 5px 10px);box-shadow:2px 2px 0 #3b2d43;opacity:${v.hv.assets};transform:${v.hv.assetsTf};transition:opacity .3s 0ms,transform .5s cubic-bezier(.2,1.5,.4,1) 0ms`)}></span><span style={css(`width:26%;aspect-ratio:1;border:2px solid #3b2d43;border-radius:7px;background:repeating-linear-gradient(135deg,#e7b86a 0 5px,#fffdf8 5px 10px);box-shadow:2px 2px 0 #3b2d43;opacity:${v.hv.assets};transform:${v.hv.assetsTf};transition:opacity .3s 120ms,transform .5s cubic-bezier(.2,1.5,.4,1) 120ms`)}></span><span style={css(`width:26%;aspect-ratio:1;border:2px solid #3b2d43;border-radius:7px;background:repeating-linear-gradient(135deg,#7fb7a8 0 5px,#fffdf8 5px 10px);box-shadow:2px 2px 0 #3b2d43;opacity:${v.hv.assets};transform:${v.hv.assetsTf};transition:opacity .3s 240ms,transform .5s cubic-bezier(.2,1.5,.4,1) 240ms`)}></span>
                  </div>
                  <div style={css(`position:absolute;left:10%;right:10%;top:22%;bottom:22%;display:flex;flex-direction:column;justify-content:space-between;opacity:${v.hv.story};transition:opacity .35s`)}>
                    <span style={css(`align-self:flex-start;padding:3px 9px;border:2px solid #3b2d43;border-radius:7px;background:#b7a4d6;font:500 11px 'Fira Code',monospace;color:#3b2d43`)}>hook</span>
                    <span style={css(`align-self:center;padding:3px 9px;border:2px solid #3b2d43;border-radius:7px;background:#7fb7a8;font:500 11px 'Fira Code',monospace;color:#3b2d43`)}>middle</span>
                    <span style={css(`align-self:flex-end;padding:3px 9px;border:2px solid #3b2d43;border-radius:7px;background:#e7b86a;font:500 11px 'Fira Code',monospace;color:#3b2d43`)}>close</span>
                  </div>
                  <div style={css(`position:absolute;left:9%;top:9%;padding:6px 12px;border:2.5px solid #3b2d43;border-radius:9px;background:#e7b86a;box-shadow:3px 3px 0 #3b2d43;font:800 clamp(15px,4vw,20px)/1 'Baloo 2',sans-serif;color:#3b2d43;opacity:${v.hv.gfx};transform:${v.hv.gfxTf};transition:opacity .25s,transform .55s cubic-bezier(.2,1.6,.4,1)`)}>MY NEW DESK</div>
                  <span data-v="ring" style={css(`position:absolute;left:28%;top:25%;width:44%;aspect-ratio:1;border-radius:50%;border:3px solid #fffdf8;box-shadow:0 0 16px rgba(255,253,248,.8);opacity:${v.hv.gfx};transition:opacity .3s`)}></span>
                  <div style={css(`position:absolute;left:0;bottom:16%;padding:5px 12px 5px 10px;border:2px solid #3b2d43;border-left:0;border-radius:0 9px 9px 0;background:#fffdf8;font:700 13px 'Baloo 2',sans-serif;color:#3b2d43;transform:${v.hv.lowerTf};transition:transform .5s cubic-bezier(.2,1.2,.4,1) .15s`)}>day one</div>
                  <div style={css(`position:absolute;left:8%;right:8%;bottom:5%;height:7%;display:flex;align-items:flex-end;gap:3px;opacity:${v.hv.snd};transition:opacity .35s`)}><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.30)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.80)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.59)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.37)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.87)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.66)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.44)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.94)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.73)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.51)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.30)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.80)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.59)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.37)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.87)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.66)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.44)`)}></span><span data-v="bar" style={css(`flex:1;height:100%;background:#7fb7a8;border-radius:2px;transform-origin:50% 100%;transform:scaleY(0.94)`)}></span></div>
                  <span data-v="scan" style={css(`position:absolute;left:0;right:0;top:0;height:3px;background:#7fb7a8;box-shadow:0 0 14px 4px rgba(127,183,168,.8);opacity:${v.hv.qc};transition:opacity .3s`)}></span>
                  <span style={css(`position:absolute;right:7%;top:3%;padding:3px 8px;border:2px solid #3b2d43;border-radius:7px;background:${v.hv.badgeBg};font:500 11px 'Fira Code',monospace;color:#3b2d43;opacity:${v.hv.badge};transition:opacity .3s,background .3s`)}>{v.hv.badgeText}</span>
                  <div style={css(`position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,253,248,.3);opacity:${v.hv.ready};transition:opacity .3s`)}><span data-v="progress" style={css(`position:absolute;inset:0;background:#e7b86a;transform-origin:0 50%;transform:scaleX(0)`)}></span></div>
                </div>
                <div style={css(`display:inline-flex;align-items:center;gap:10px;padding:7px 14px 7px 10px;background:#fffdf8;border:2px solid #3b2d43;border-radius:999px;box-shadow:2px 2px 0 #3b2d43;font:700 15px 'Baloo 2',sans-serif;max-width:100%`)}><span style={css(`width:12px;height:12px;flex:none;border-radius:50%;border:2px solid #3b2d43;background:${v.crewDot};transition:background .4s`)}></span><span style={css(`overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}>{v.crewCaption}</span></div>
              </div>
              <div style={css(`grid-column:1/-1;position:relative;min-width:0;background:#fffdf8;border:2px solid #3b2d43;border-radius:14px;box-shadow:4px 4px 0 #3b2d43;overflow:hidden`)}>
                <div style={css(`display:flex;align-items:center;gap:10px;padding:7px 10px 7px 12px;background:#efe7d9;border-bottom:2px solid #3b2d43;min-width:0`)}>
                  <span style={css(`display:grid;gap:2px;flex:none`)}><span style={css(`width:11px;height:3px;margin-left:4px;border-radius:2px;background:#e7b86a;box-shadow:0 0 0 1px #3b2d43`)}></span><span style={css(`width:15px;height:3px;border-radius:2px;background:#b7a4d6;box-shadow:0 0 0 1px #3b2d43`)}></span><span style={css(`width:9px;height:3px;margin-left:2px;border-radius:2px;background:#7fb7a8;box-shadow:0 0 0 1px #3b2d43`)}></span></span>
                  <span style={css(`flex:none;font:800 15px/1 'Baloo 2',sans-serif;padding-top:2px`)}>Timeline</span>
                  <span style={css(`min-width:0;font:500 11px/1 'Fira Code',monospace;color:#5b4d66;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>desk-setup-short</span>
                  <span style={css(`margin-left:auto;flex:none;display:flex;align-items:center;gap:9px`)}>
                    <span style={css(`display:${v.tl.specDisp};font:500 10px/1 'Fira Code',monospace;color:#5b4d66;white-space:nowrap`)}>9:16 · 30 fps</span>
                    <span style={css(`position:relative;width:10px;height:10px`)}>
                      <span style={css(`position:absolute;left:1px;top:0;border-left:9px solid #3b2d43;border-top:5px solid transparent;border-bottom:5px solid transparent;opacity:${v.tl.playOp};transition:opacity .2s`)}></span>
                      <span style={css(`position:absolute;inset:0;display:flex;justify-content:space-between;padding:0 1px;opacity:${v.tl.pauseOp};transition:opacity .2s`)}><span style={css(`width:3px;border-radius:1px;background:#3b2d43`)}></span><span style={css(`width:3px;border-radius:1px;background:#3b2d43`)}></span></span>
                    </span>
                    <span ref={v.tlTcRef} style={css(`padding:4px 7px 3px;border-radius:6px;background:#3b2d43;color:#e7b86a;font:500 11px/1 'Fira Code',monospace;letter-spacing:.02em`)}>00:00:24:24</span>
                  </span>
                </div>
                <div style={css(`position:relative;display:grid;grid-template-columns:44px minmax(0,1fr)`)}>
                  <span style={css(`background:#efe7d9;border-right:2px solid #3b2d43;border-bottom:1.5px solid #3b2d43`)}></span>
                  <div data-lane="ruler" style={css(`position:relative;height:26px;background:#f7f2ea;border-bottom:1.5px solid #3b2d43;overflow:hidden`)}>
                    <span style={css(`position:absolute;left:0;right:0;bottom:3px;height:4px;background:repeating-linear-gradient(90deg,rgba(59,45,67,.3) 0 1px,transparent 1px 2.5%)`)}></span>
                    <span style={css(`position:absolute;left:0;right:0;bottom:3px;height:8px;background:repeating-linear-gradient(90deg,rgba(59,45,67,.45) 0 1px,transparent 1px 12.5%)`)}></span>
                    {RULER.map((t, i) => <span key={t} style={css(`position:absolute;left:${i * 25}%;top:0;bottom:3px;padding:4px 0 0 4px;border-left:1px solid rgba(59,45,67,.55);font:500 9px/1 'Fira Code',monospace;color:#5b4d66`)}>{t}</span>)}
                    {v.tl.marks.map((m, i) => <svg key={i} width="10" height="11" viewBox="0 0 10 11" style={css(`position:absolute;left:${m.left};top:11px;overflow:visible;transform-origin:50% 100%;opacity:${m.op};transform:${m.tf};transition:${m.tr}`)}><path d="M1 1h8v5.5L5 10 1 6.5z" fill={m.c} stroke="#3b2d43" strokeWidth="1.3" strokeLinejoin="round"></path></svg>)}
                    <span style={css(`position:absolute;left:0;right:0;bottom:0;height:3px;background:#e7b86a;opacity:${v.tl.checkOp};transition:opacity .3s`)}><span ref={v.tlCheckRef} style={css(`position:absolute;inset:0;background:#7fb7a8;transform-origin:0 50%;transform:scaleX(1)`)}></span></span>
                  </div>
                  <span style={css(`display:flex;align-items:center;justify-content:space-between;gap:4px;padding:0 6px 0 8px;background:#efe7d9;border-right:2px solid #3b2d43;border-bottom:1px solid rgba(59,45,67,.14);font:500 10px/1 'Fira Code',monospace;color:#3b2d43`)}>V2<svg width="11" height="8" viewBox="0 0 11 8" aria-hidden="true"><path d="M.8 4Q5.5-1.8 10.2 4Q5.5 9.8.8 4Z" fill="none" stroke="#5b4d66" strokeWidth="1.2"></path><circle cx="5.5" cy="4" r="1.6" fill="#5b4d66"></circle></svg></span>
                  <div data-lane="v2" style={css(`position:relative;height:24px;border-bottom:1px solid rgba(59,45,67,.14)`)}>
                    {v.tl.v2.map((c, i) => <span key={i} style={css(`position:absolute;top:3px;bottom:3px;left:${c.left};width:${c.width};border:1.5px solid #3b2d43;border-radius:4px;overflow:hidden;padding:0 5px;background:${c.bg};font:800 9px/15px 'Baloo 2',sans-serif;letter-spacing:.02em;white-space:nowrap;text-overflow:ellipsis;opacity:${c.op};transform:${c.tf};transition:${c.tr}`)}>{c.label}</span>)}
                  </div>
                  <span style={css(`display:flex;align-items:center;justify-content:space-between;gap:4px;padding:0 6px 0 8px;background:#efe7d9;border-right:2px solid #3b2d43;border-bottom:1px solid rgba(59,45,67,.14);font:500 10px/1 'Fira Code',monospace;color:#3b2d43`)}>V1<svg width="11" height="8" viewBox="0 0 11 8" aria-hidden="true"><path d="M.8 4Q5.5-1.8 10.2 4Q5.5 9.8.8 4Z" fill="none" stroke="#5b4d66" strokeWidth="1.2"></path><circle cx="5.5" cy="4" r="1.6" fill="#5b4d66"></circle></svg></span>
                  <div data-lane="v1" style={css(`position:relative;height:32px;border-bottom:1px solid rgba(59,45,67,.14)`)}>
                    {v.tl.v1.map((c, i) => (
                      <span key={i} style={css(`position:absolute;top:3px;bottom:3px;left:${c.left};width:${c.width};border:1.5px solid #3b2d43;border-radius:4px;overflow:hidden;background:${c.bg};opacity:${c.op};clip-path:${c.clip};transition:${c.tr}`)}>
                        <span style={css(`position:absolute;left:0;top:0;bottom:0;width:20px;background:${c.thumb};border-right:1.5px solid #3b2d43`)}>
                          <span style={css(`position:absolute;left:3px;bottom:-2px;width:13px;height:9px;border-radius:5px 5px 2px 2px;background:#6f5a9a;border:1.5px solid #3b2d43`)}></span>
                          <span style={css(`position:absolute;left:5px;top:3px;width:8px;height:8px;border-radius:50%;background:#efe7d9;border:1.5px solid #3b2d43`)}></span>
                        </span>
                      </span>
                    ))}
                  </div>
                  <span style={css(`display:flex;align-items:center;justify-content:space-between;gap:4px;padding:0 6px 0 8px;background:#efe7d9;border-right:2px solid #3b2d43;border-bottom:1px solid rgba(59,45,67,.14);font:500 10px/1 'Fira Code',monospace;color:#3b2d43`)}>A1<svg width="11" height="9" viewBox="0 0 11 9" aria-hidden="true"><path d="M1 3h2.2L6 1v7L3.2 6H1z" fill="#5b4d66"></path><path d="M8 2.6q1.6 1.9 0 3.8" fill="none" stroke="#5b4d66" strokeWidth="1.2" strokeLinecap="round"></path></svg></span>
                  <div data-lane="a1" style={css(`position:relative;height:24px;border-bottom:1px solid rgba(59,45,67,.14)`)}>
                    {v.tl.a1.map((c, i) => (
                      <span key={i} style={css(`position:absolute;top:3px;bottom:3px;left:${c.left};width:${c.width};border:1.5px solid #3b2d43;border-radius:4px;overflow:hidden;background:#7fb7a8;opacity:${c.op};clip-path:${c.clip};transition:${c.tr}`)}>
                        <svg viewBox={`0 0 ${c.n} 10`} preserveAspectRatio="none" style={css(`position:absolute;left:0;top:1px;width:100%;height:calc(100% - 2px)`)}><path d={c.wave} fill="#2f6b5e"></path></svg>
                      </span>
                    ))}
                  </div>
                  <span style={css(`display:flex;align-items:center;justify-content:space-between;gap:4px;padding:0 6px 0 8px;background:#efe7d9;border-right:2px solid #3b2d43;font:500 10px/1 'Fira Code',monospace;color:#3b2d43`)}>A2<svg width="11" height="9" viewBox="0 0 11 9" aria-hidden="true"><path d="M1 3h2.2L6 1v7L3.2 6H1z" fill="#5b4d66"></path><path d="M8 2.6q1.6 1.9 0 3.8" fill="none" stroke="#5b4d66" strokeWidth="1.2" strokeLinecap="round"></path></svg></span>
                  <div data-lane="a2" style={css(`position:relative;height:24px`)}>
                    <span style={css(`position:absolute;top:3px;bottom:3px;left:0;width:100%;border:1.5px solid #3b2d43;border-radius:4px;overflow:hidden;background:#a8d0c5;opacity:${v.tl.a2.op};clip-path:${v.tl.a2.clip};transition:${v.tl.a2.tr}`)}>
                      <svg viewBox={`0 0 ${v.tl.a2.n} 10`} preserveAspectRatio="none" style={css(`position:absolute;left:0;top:1px;width:100%;height:calc(100% - 2px)`)}><path d={v.tl.a2.wave} fill="#2f6b5e" opacity=".55"></path></svg>
                      <span style={css(`position:absolute;left:0;top:0;bottom:0;width:8%;background:linear-gradient(to bottom right,rgba(59,45,67,.3) 50%,transparent 50%)`)}></span>
                      <span style={css(`position:absolute;right:0;top:0;bottom:0;width:8%;background:linear-gradient(to bottom left,rgba(59,45,67,.3) 50%,transparent 50%)`)}></span>
                    </span>
                  </div>
                  <div style={css(`position:absolute;top:0;bottom:0;left:44px;right:0;pointer-events:none;z-index:2`)}>
                    <div ref={v.tlHeadRef} style={css(`position:absolute;inset:0;transform:translateX(62%)`)}>
                      <span style={css(`position:absolute;left:-1px;top:0;bottom:0;width:2px;background:#a3405c`)}></span>
                      <svg width="12" height="14" viewBox="0 0 12 14" style={css(`position:absolute;left:-6px;top:0`)}><path d="M1 1h10v7.5L6 13 1 8.5z" fill="#a3405c" stroke="#3b2d43" strokeWidth="1.4" strokeLinejoin="round"></path></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section id="how" ref={v.phasesRef} aria-labelledby="how-title" style={css(`position:relative;height:340vh;background:#efe7d9;border-bottom:2px solid #3b2d43`)}>
        <div style={css(`position:sticky;top:0;height:100vh;display:flex;align-items:center;overflow:hidden`)}>
          <div style={css(`width:100%;max-width:1180px;margin:0 auto;padding:72px 24px 32px;display:flex;flex-direction:column;gap:clamp(24px,4vh,44px)`)}>
            <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
              <div style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#5b4d66`)}>
                <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
                <span>How it works</span>
              </div>
              <h2 id="how-title" style={css(`margin:0;font:800 clamp(34px,5vw,58px)/1 'Baloo 2',sans-serif;letter-spacing:-.025em;text-wrap:balance`)}>Five phases, from one sentence to a finished short.</h2>
            </div>

            <div style={css(`position:relative`)}>
              <div style={css(`position:absolute;left:10%;right:10%;top:17px;height:4px;background:repeating-linear-gradient(90deg,#3b2d43 0 8px,transparent 8px 14px);opacity:.5`)}></div>
              <div ref={v.lineRef} style={css(`position:absolute;left:10%;right:10%;top:16px;height:6px`)}>
                <div ref={v.fillRef} style={css(`position:absolute;inset:0;background:#6f5a9a;border-radius:3px;transform-origin:0 50%;transform:scaleX(0)`)}></div>
                <div ref={v.beadRef} aria-hidden="true" style={css(`position:absolute;left:-15px;top:-12px;width:30px;height:30px;will-change:transform`)}>
                  <span style={css(`position:absolute;inset:-18px;border-radius:50%;background:radial-gradient(closest-side,rgba(231,184,106,.9),rgba(231,184,106,0));`)}></span>
                  <span style={css(`position:absolute;inset:0;border-radius:50%;background:#e7b86a;border:3px solid #3b2d43;box-shadow:0 0 0 4px #fffdf8`)}></span>
                </div>
              </div>
              <ol style={css(`position:relative;list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr))`)}>
                {v.phaseNodes.map((n, _n) => (<React.Fragment key={_n}>
                  <li style={css(`display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center`)}>
                    <span style={css(`width:38px;height:38px;display:grid;place-items:center;border-radius:50%;border:2px solid #3b2d43;background:${n.bg};font:800 16px/1 'Baloo 2',sans-serif;transition:background .3s;position:relative;z-index:1`)}>{n.num}</span>
                    <span style={css(`font:800 clamp(14px,2vw,20px)/1.1 'Baloo 2',sans-serif;color:${n.fg};transition:color .3s`)}>{n.name}</span>
                  </li>
                </React.Fragment>))}
              </ol>
            </div>

            <div style={css(`display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(20px,4vw,48px);align-items:center`)}>
              <div aria-hidden="true" className="phase-morph" style={css(`position:relative;justify-self:center;width:min(100%,64vh);aspect-ratio:16/10;background:#fffdf8;border:2px solid #3b2d43;border-radius:18px;box-shadow:5px 5px 0 #3b2d43;overflow:hidden;container-type:inline-size`)}>
                {v.phaseMorph.map(p => (
                  <span key={p.id} style={css(p.style)}>
                    {p.children}
                    {p.layers.map((l, i) => <span key={i} style={css(l.style)}>{l.children}</span>)}
                  </span>
                ))}
              </div>
              <div className="phase-copy" style={css(`display:flex;flex-direction:column;gap:12px;min-width:0`)}>
                <span aria-hidden="true" style={css(`display:flex;align-items:center;gap:.6ch;font:500 14px/1.3 'Fira Code',monospace;color:#6f5a9a`)}>
                  Phase
                  <span style={css(`display:inline-block;height:1.3em;overflow:hidden`)}>
                    <span style={css(`display:block;transform:${v.phaseNumTf};transition:transform .6s cubic-bezier(.76,0,.24,1)`)}>
                      {[1, 2, 3, 4, 5].map(n => <span key={n} style={css(`display:block;height:1.3em`)}>{n}</span>)}
                    </span>
                  </span>
                  of 5
                </span>
                <div style={css(`height:1.15em;overflow:hidden;font:800 clamp(36px,5vw,64px)/1.15 'Baloo 2',sans-serif;letter-spacing:-.02em`)}>
                  <div style={css(`transform:${v.phaseNameTf};transition:transform .7s cubic-bezier(.76,0,.24,1)`)}>
                    {v.phaseCopy.map(p => <h3 key={p.name} style={css(`margin:0;height:1.15em;font:inherit;letter-spacing:inherit`)}>{p.name}</h3>)}
                  </div>
                </div>
                <div style={css(`display:grid`)}>
                  {v.phaseCopy.map(p => <p key={p.name} style={css(`grid-area:1/1;margin:0;font-size:clamp(18px,2vw,22px);line-height:1.45;color:#5b4d66;max-width:30ch;text-wrap:pretty;opacity:${p.op};transform:${p.tf};pointer-events:${p.pe};transition:${p.tr}`)}>{p.line}</p>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="watch" aria-labelledby="watch-title" style={css(`border-bottom:2px solid #3b2d43;background:#f4efe6`)}>
        <div style={css(`max-width:1180px;margin:0 auto;padding:clamp(72px,10vw,120px) 24px;display:flex;flex-direction:column;gap:40px`)}>
          <div data-reveal="0" style={css(`display:flex;flex-direction:column;gap:14px;max-width:720px`)}>
            <div style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#5b4d66`)}>
              <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
              <span>The built-in reviewer</span>
            </div>
            <h2 id="watch-title" style={css(`margin:0;font:800 clamp(34px,5vw,58px)/1 'Baloo 2',sans-serif;letter-spacing:-.025em`)}>Watch it work</h2>
            <p style={css(`margin:0;font-size:19px;line-height:1.5;color:#5b4d66;text-wrap:pretty`)}>A playable cut shows up early. Watch it, leave notes at the exact moment, and send them as one round. The agent revises, and you approve when it's right.</p>
          </div>

          <div ref={v.mockRef} data-reveal="100" role="img" aria-label="Illustration of the Phosphor window: a timeline builds, the agent asks a question, review notes arrive and the status changes to Ready." style={css(`background:#fffdf8;border:2px solid #3b2d43;border-radius:20px;box-shadow:8px 8px 0 #3b2d43;overflow:hidden`)}>
            <div style={css(`display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:2px solid #3b2d43;background:#efe7d9`)}>
              <span style={css(`width:34px;height:29px;padding:5px 6px 7px;background:#3b2d43;border-radius:8px 8px 6px 6px;display:flex;flex:none`)}>
                <span style={css(`flex:1;border-radius:4px;background:${v.mockScreen};transition:background .4s;position:relative`)}><span style={css(`position:absolute;left:24%;top:32%;width:14%;height:22%;background:#3b2d43`)}></span><span style={css(`position:absolute;right:24%;top:32%;width:14%;height:22%;background:#3b2d43`)}></span></span>
              </span>
              <span style={css(`font:800 18px 'Baloo 2',sans-serif`)}>Phosphor</span>
              <span style={css(`font:500 13px 'Fira Code',monospace;color:#5b4d66;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0`)}>desk-setup-short</span>
              <span style={css(`position:relative;margin-left:auto;flex:none`)}>
                <span style={css(`display:inline-flex;align-items:center;gap:8px;padding:5px 14px 5px 8px;border:2px solid #3b2d43;border-radius:999px;background:${v.pillBg};color:${v.pillFg};font:800 15px 'Baloo 2',sans-serif;box-shadow:2px 2px 0 #3b2d43;transition:background .35s,color .35s`)}>
                  <span style={css(`width:10px;height:10px;border-radius:50%;background:${v.pillFg};opacity:.85`)}></span>{v.pillText}
                </span>
                <span ref={v.burstRef} style={css(`position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none`)}></span>
              </span>
            </div>

            <div style={css(`display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));border-bottom:2px solid #3b2d43`)}>
              <div style={css(`display:flex;justify-content:center;align-items:center;padding:28px;background:#3b2d43;position:relative;overflow:hidden`)}>
                <span style={css(`position:absolute;inset:0;background:radial-gradient(closest-side,rgba(183,164,214,.35),transparent)`)}></span>
                <div style={css(`position:relative;width:min(240px,62vw);aspect-ratio:9/16;border-radius:14px;overflow:hidden;background:#b7a4d6;box-shadow:0 0 0 3px #fffdf8,0 0 40px rgba(183,164,214,.6)`)}>
                  <span style={css(`position:absolute;inset:0;background:repeating-linear-gradient(135deg,#c6b7df 0 10px,#b7a4d6 10px 20px)`)}></span>
                  <span data-mockanim="a" style={css(`position:absolute;left:14%;top:18%;width:46%;aspect-ratio:1;border-radius:50%;background:#e7b86a;border:3px solid #3b2d43`)}></span>
                  <span data-mockanim="b" style={css(`position:absolute;left:10%;top:62%;width:70%;height:7%;border-radius:6px;background:#fffdf8;border:3px solid #3b2d43`)}></span>
                  <span data-mockanim="c" style={css(`position:absolute;left:10%;top:72%;width:44%;height:5%;border-radius:6px;background:#7fb7a8;border:3px solid #3b2d43`)}></span>
                  <span style={css(`position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(59,45,67,.1) 3px 4px)`)}></span>
                  <span style={css(`position:absolute;left:8px;top:8px;padding:2px 7px;border-radius:6px;background:rgba(59,45,67,.8);color:#fffdf8;font:500 11px 'Fira Code',monospace`)}>your video</span>
                  <span ref={v.tcRef} style={css(`position:absolute;right:8px;bottom:8px;padding:2px 7px;border-radius:6px;background:rgba(59,45,67,.8);color:#fffdf8;font:500 11px 'Fira Code',monospace`)}>00:00 / 00:32</span>
                </div>
              </div>

              <div style={css(`display:flex;flex-direction:column;gap:14px;padding:22px;min-width:0`)}>
                <div style={css(`display:flex;gap:10px;align-items:flex-start`)}>
                  <span style={css(`font:500 12px 'Fira Code',monospace;color:#6f5a9a;padding-top:3px;flex:none`)}>Director</span>
                  <span style={css(`font-size:16px;line-height:1.4`)}>{v.agentMsg}</span>
                </div>
                <div style={css(`padding:14px;border:2px solid #3b2d43;border-radius:14px;background:#fbf1dd;display:flex;flex-direction:column;gap:10px;opacity:${v.qOp};transform:${v.qTf};transition:opacity .35s,transform .45s cubic-bezier(.2,1.4,.4,1)`)}>
                  <span style={css(`font:700 16px 'Baloo 2',sans-serif`)}>Keep the cold open at the start?</span>
                  <div style={css(`display:flex;gap:8px`)}>
                    <span style={css(`padding:4px 12px;border:2px solid #3b2d43;border-radius:9px;background:${v.keepBg};font:700 14px 'Baloo 2',sans-serif;transition:background .25s`)}>Keep it</span>
                    <span style={css(`padding:4px 12px;border:2px solid #3b2d43;border-radius:9px;background:#fffdf8;font:700 14px 'Baloo 2',sans-serif`)}>Cut it</span>
                  </div>
                </div>
                <div style={css(`display:flex;flex-direction:column;gap:8px`)}>
                  <span style={css(`font:500 12px 'Fira Code',monospace;color:#5b4d66`)}>Your notes · round 1</span>
                  {v.notes.map((nt, _nt) => (<React.Fragment key={_nt}>
                    <div style={css(`display:flex;gap:10px;align-items:center;padding:9px 12px;border:2px solid #3b2d43;border-radius:11px;background:#fffdf8;box-shadow:2px 2px 0 #3b2d43;opacity:${nt.op};transform:${nt.tf};transition:opacity .3s,transform .45s cubic-bezier(.2,1.5,.4,1)`)}>
                      <span style={css(`font:500 12px 'Fira Code',monospace;color:#fffdf8;background:#6f5a9a;padding:2px 6px;border-radius:5px;flex:none`)}>{nt.t}</span>
                      <span style={css(`font-size:15px`)}>{nt.text}</span>
                    </div>
                  </React.Fragment>))}
                </div>
                <div style={css(`margin-top:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap;opacity:${v.readyOp};transition:opacity .4s`)}>
                  <span style={css(`padding:8px 16px;border:2px solid #3b2d43;border-radius:11px;background:#e7b86a;box-shadow:3px 3px 0 #3b2d43;font:800 15px 'Baloo 2',sans-serif`)}>Approve &amp; export</span>
                  <span style={css(`font:500 12px 'Fira Code',monospace;color:#2f6b5e`)}>v2 · checked</span>
                </div>
              </div>
            </div>

            <div style={css(`padding:16px 18px 20px;display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px 10px;align-items:center;background:#fffdf8`)}>
              <span></span>
              <div style={css(`display:flex;justify-content:space-between;font:400 11px 'Fira Code',monospace;color:#5b4d66`)}><span>00:00</span><span>00:08</span><span>00:16</span><span>00:24</span><span>00:32</span></div>
              <span style={css(`font:500 12px 'Fira Code',monospace;color:#5b4d66`)}>V2</span>
              <div ref={v.tlRef} style={css(`position:relative;height:24px;grid-row:span 1`)}>
                {v.clipsV2.map((c, _c) => (<React.Fragment key={_c}><span style={css(`position:absolute;top:0;bottom:0;left:${c.left};width:${c.width};border:2px solid #3b2d43;border-radius:6px;background:#e7b86a;transform-origin:0 50%;opacity:${c.op};transform:${c.tf};transition:opacity .25s,transform .4s cubic-bezier(.2,1.3,.4,1)`)}></span></React.Fragment>))}
              </div>
              <span style={css(`font:500 12px 'Fira Code',monospace;color:#5b4d66`)}>V1</span>
              <div style={css(`position:relative;height:30px`)}>
                {v.clipsV1.map((c, _c) => (<React.Fragment key={_c}><span style={css(`position:absolute;top:0;bottom:0;left:${c.left};width:${c.width};border:2px solid #3b2d43;border-radius:6px;background:#b7a4d6;transform-origin:0 50%;opacity:${c.op};transform:${c.tf};transition:opacity .25s,transform .4s cubic-bezier(.2,1.3,.4,1)`)}></span></React.Fragment>))}
              </div>
              <span style={css(`font:500 12px 'Fira Code',monospace;color:#5b4d66`)}>A1</span>
              <div style={css(`position:relative;height:24px`)}>
                {v.clipsA1.map((c, _c) => (<React.Fragment key={_c}><span style={css(`position:absolute;top:0;bottom:0;left:${c.left};width:${c.width};border:2px solid #3b2d43;border-radius:6px;background:repeating-linear-gradient(90deg,#7fb7a8 0 3px,#a8d0c5 3px 6px);transform-origin:0 50%;opacity:${c.op};transform:${c.tf};transition:opacity .25s,transform .4s cubic-bezier(.2,1.3,.4,1)`)}></span></React.Fragment>))}
                <span ref={v.playheadRef} style={css(`position:absolute;left:0;top:-72px;bottom:-4px;width:3px;margin-left:-1px;background:#a3405c;border-radius:2px;will-change:transform`)}></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="example" aria-labelledby="example-title" style={css(`position:relative;overflow:hidden;border-bottom:2px solid #3b2d43;background:#3b2d43;color:#fffdf8`)}>
        <span aria-hidden="true" style={css(`position:absolute;right:-12%;top:-30%;width:760px;height:760px;border-radius:50%;background:radial-gradient(closest-side,rgba(183,164,214,.3),transparent);pointer-events:none`)}></span>
        <div style={css(`position:relative;max-width:1180px;margin:0 auto;padding:clamp(72px,10vw,120px) 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:clamp(40px,6vw,72px);align-items:center`)}>
          <div data-reveal="0" style={css(`display:flex;flex-direction:column;gap:18px`)}>
            <div style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#dcd2ee`)}>
              <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
              <span>Made with Phosphor</span>
            </div>
            <h2 id="example-title" style={css(`margin:0;font:800 clamp(34px,5vw,58px)/1 'Baloo 2',sans-serif;letter-spacing:-.025em;text-wrap:balance`)}>A real short, made with Phosphor</h2>
            <p style={css(`margin:0;font-size:19px;line-height:1.5;color:#dcd2ee;max-width:38ch;text-wrap:pretty`)}>Sloppenheimer is a 73-second short made with Phosphor: talking head, captions, motion graphics and b-roll, delivered at 1080 × 1920.</p>
            <span style={css(`font:500 13px 'Fira Code',monospace;color:#b7a4d6`)}>1:13 · 1080 × 1920 · 23.976 fps</span>
            <div>
              <button type="button" onClick={v.exWatch} className="btn-ex" style={css(`display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:10px 22px;border:2px solid #fffdf8;border-radius:14px;background:#e7b86a;box-shadow:4px 4px 0 #fffdf8;color:#3b2d43;font:800 18px/1 'Baloo 2',sans-serif;cursor:pointer;transition:transform .15s,box-shadow .15s`)}>
                <span aria-hidden="true" style={css(`width:0;height:0;border-left:11px solid #3b2d43;border-top:7px solid transparent;border-bottom:7px solid transparent`)}></span>Watch with sound
              </button>
            </div>
          </div>
          <div data-reveal="100" style={css(`display:flex;justify-content:center`)}>
            <div style={css(`position:relative;width:min(300px,76vw);aspect-ratio:9/16;border-radius:24px;overflow:hidden;background:#1f1724;border:3px solid #fffdf8;box-shadow:0 0 0 3px #3b2d43,0 0 70px rgba(183,164,214,.45)`)}>
              <video ref={v.exVideoRef} src="media/sloppenheimer.mp4" poster="media/sloppenheimer-poster.jpg" muted loop playsInline preload="none" aria-label="Sloppenheimer, a short made with Phosphor" onClick={v.exToggle} style={css(`display:block;width:100%;height:100%;object-fit:cover;cursor:pointer`)}></video>
              <button type="button" onClick={v.exToggle} aria-label={v.exPlaying ? 'Pause' : 'Play'} className="ex-play" style={css(`position:absolute;left:50%;top:50%;width:68px;height:68px;margin:-34px 0 0 -34px;display:grid;place-items:center;border:3px solid #3b2d43;border-radius:50%;background:#fffdf8;box-shadow:3px 3px 0 #3b2d43;cursor:pointer;opacity:${v.exPlayOp};pointer-events:${v.exPlaying ? 'none' : 'auto'};transition:opacity .25s`)}>
                <span aria-hidden="true" style={css(`margin-left:5px;width:0;height:0;border-left:20px solid #3b2d43;border-top:12px solid transparent;border-bottom:12px solid transparent`)}></span>
              </button>
              <button type="button" onClick={v.exSound} aria-pressed={!v.exMuted} style={css(`position:absolute;left:12px;bottom:16px;display:inline-flex;align-items:center;gap:7px;padding:6px 12px 6px 10px;border:2px solid #3b2d43;border-radius:999px;background:#fffdf8;box-shadow:2px 2px 0 #3b2d43;color:#3b2d43;font:700 14px/1 'Baloo 2',sans-serif;cursor:pointer`)}>
                <svg width="15" height="12" viewBox="0 0 15 12" aria-hidden="true"><path d="M1 4h2.5L7 1v10L3.5 8H1z" fill="#3b2d43"></path>{v.exMuted ? <path d="M9.5 4l3.5 4m0-4L9.5 8" stroke="#3b2d43" strokeWidth="1.6" strokeLinecap="round"></path> : <path d="M9.5 3.5q2 2.5 0 5M11.8 1.8q3.4 4.2 0 8.4" fill="none" stroke="#3b2d43" strokeWidth="1.5" strokeLinecap="round"></path>}</svg>{v.exSoundLabel}
              </button>
              <span aria-hidden="true" style={css(`position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,253,248,.25)`)}><span ref={v.exBarRef} style={css(`position:absolute;inset:0;background:#e7b86a;transform-origin:0 50%;transform:scaleX(0);transition:transform .25s linear`)}></span></span>
            </div>
          </div>
        </div>
      </section>

      <section id="control" ref={v.controlRef} aria-labelledby="control-title" style={css(`border-bottom:2px solid #3b2d43;background:#efe7d9`)}>
        <div style={css(`max-width:1180px;margin:0 auto;padding:clamp(72px,10vw,120px) 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:clamp(40px,6vw,72px);align-items:center`)}>
          <div data-reveal="0" style={css(`display:flex;flex-direction:column;gap:20px;padding:clamp(20px,3vw,32px);background:#fffdf8;border:2px solid #3b2d43;border-radius:20px;box-shadow:6px 6px 0 #3b2d43`)}>
            <div style={css(`display:flex;align-items:center;justify-content:space-between;gap:16px`)}>
              <div style={css(`display:flex;flex-direction:column;gap:2px`)}>
                <span id="cc-label" style={css(`font:800 20px 'Baloo 2',sans-serif`)}>Computer control</span>
                <span style={css(`font-size:14px;color:#5b4d66`)}>{v.controlSub}</span>
              </div>
              <button type="button" role="switch" aria-checked={v.controlAria} aria-labelledby="cc-label" onClick={v.toggleControl} style={css(`position:relative;flex:none;width:72px;height:40px;padding:0;border:2px solid #3b2d43;border-radius:999px;background:#efe7d9;cursor:pointer;overflow:hidden`)}>
                <span style={css(`position:absolute;inset:0;background:#7fb7a8;opacity:${v.onLayerOp};transition:opacity .25s`)}></span>
                <span ref={v.knobRef} style={css(`position:absolute;left:4px;top:4px;width:28px;height:28px`)}>
                  <span style={css(`position:absolute;inset:0;border-radius:50%;background:#fffdf8;border:2px solid #3b2d43;box-shadow:1px 2px 0 #3b2d43;transform:${v.knobTf};transition:transform .35s cubic-bezier(.2,1.5,.4,1)`)}></span>
                </span>
              </button>
            </div>
            <div style={css(`position:relative;height:150px;border:2px solid #3b2d43;border-radius:14px;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(59,45,67,.06) 3px 4px),#dcd2ee;overflow:hidden`)}>
              <span style={css(`position:absolute;left:14px;top:14px;width:40%;height:10px;border-radius:5px;background:#fffdf8;border:2px solid #3b2d43`)}></span>
              <span style={css(`position:absolute;left:14px;top:34px;width:26%;height:10px;border-radius:5px;background:#fffdf8;border:2px solid #3b2d43`)}></span>
              <span style={css(`position:absolute;left:14px;right:14px;bottom:14px;height:34px;border-radius:8px;background:#b7a4d6;border:2px solid #3b2d43`)}></span>
              <span ref={v.cursorRef} aria-hidden="true" style={css(`position:absolute;left:0;top:0;width:22px;height:22px;opacity:${v.cursorOp};transition:opacity .25s`)}>
                <span style={css(`position:absolute;inset:0;border-radius:50%;background:rgba(127,183,168,.5)`)}></span>
                <span style={css(`position:absolute;left:6px;top:6px;width:10px;height:10px;border-radius:50%;background:#2f6b5e;border:2px solid #fffdf8`)}></span>
              </span>
              <span style={css(`position:absolute;right:12px;top:12px;padding:3px 9px;border-radius:7px;background:#fffdf8;border:2px solid #3b2d43;font:500 12px 'Fira Code',monospace`)}>{v.screenTag}</span>
            </div>
            <div style={css(`display:flex;flex-direction:column;align-items:center;gap:12px`)}>
              <button ref={v.stopRef} type="button" onClick={v.stopNow} style={css(`width:100%;min-height:76px;padding:14px 24px;border:3px solid #3b2d43;border-radius:20px;background:#a3405c;color:#fffdf8;box-shadow:5px 5px 0 #3b2d43;font:800 clamp(24px,3vw,30px)/1 'Baloo 2',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:14px;transition:transform .12s,box-shadow .12s`)} className="btn-stop">
                <span style={css(`width:22px;height:22px;border-radius:5px;background:#fffdf8;flex:none`)}></span>Stop &amp; take over
              </button>
              <div style={css(`display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center`)}>
                {v.keys.map((k, _k) => (<React.Fragment key={_k}><kbd style={css(`min-width:30px;padding:3px 8px;border:2px solid #3b2d43;border-bottom-width:4px;border-radius:8px;background:#fffdf8;font:500 13px 'Fira Code',monospace;text-align:center`)}>{k}</kbd></React.Fragment>))}
              </div>
              <span aria-live="polite" style={css(`font:700 16px 'Baloo 2',sans-serif;color:#2f6b5e;min-height:22px;opacity:${v.handedOp};transition:opacity .3s`)}>Control is back with you.</span>
            </div>
          </div>

          <div style={css(`display:flex;flex-direction:column;gap:28px`)}>
            <div data-reveal="0" style={css(`display:flex;flex-direction:column;gap:14px`)}>
              <div style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#5b4d66`)}>
                <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
                <span>Your hands on the wheel</span>
              </div>
              <h2 id="control-title" style={css(`margin:0;font:800 clamp(34px,5vw,58px)/1 'Baloo 2',sans-serif;letter-spacing:-.025em`)}>You stay in control</h2>
            </div>
            <ul style={css(`list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px`)}>
              <li data-reveal="60" style={css(`display:flex;gap:14px;align-items:flex-start`)}><span style={css(`width:14px;height:14px;margin-top:5px;flex:none;border-radius:3px;border:2px solid #3b2d43;background:#b7a4d6`)}></span><span style={css(`font-size:18px;line-height:1.45`)}>Computer control is off until you switch it on.</span></li>
              <li data-reveal="120" style={css(`display:flex;gap:14px;align-items:flex-start`)}><span style={css(`width:14px;height:14px;margin-top:5px;flex:none;border-radius:3px;border:2px solid #3b2d43;background:#a3405c`)}></span><span style={css(`font-size:18px;line-height:1.45`)}>One shortcut, <strong>Stop &amp; take over</strong>, hands control straight back to you.</span></li>
              <li data-reveal="180" style={css(`display:flex;gap:14px;align-items:flex-start`)}><span style={css(`width:14px;height:14px;margin-top:5px;flex:none;border-radius:3px;border:2px solid #3b2d43;background:#e7b86a`)}></span><span style={css(`font-size:18px;line-height:1.45`)}>It asks only the questions that matter, and shows its progress and decisions as it goes.</span></li>
              <li data-reveal="240" style={css(`display:flex;gap:14px;align-items:flex-start`)}><span style={css(`width:14px;height:14px;margin-top:5px;flex:none;border-radius:3px;border:2px solid #3b2d43;background:#7fb7a8`)}></span><span style={css(`font-size:18px;line-height:1.45`)}>Nothing is exported until you approve it.</span></li>
            </ul>
            <div data-reveal="300" style={css(`display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px`)}>
              <div style={css(`padding:16px 18px;border:2px solid #3b2d43;border-radius:16px;background:#fffdf8;box-shadow:3px 3px 0 #3b2d43;display:flex;flex-direction:column;gap:10px`)}>
                <span style={css(`font:800 17px 'Baloo 2',sans-serif`)}>Works with your editor</span>
                <div style={css(`display:flex;flex-wrap:wrap;gap:6px`)}>
                  <span style={css(`padding:2px 10px;border:2px solid #3b2d43;border-radius:999px;background:#dcd2ee;font-size:14px`)}>DaVinci Resolve</span>
                  <span style={css(`padding:2px 10px;border:2px solid #3b2d43;border-radius:999px;background:#dcd2ee;font-size:14px`)}>After Effects</span>
                  <span style={css(`padding:2px 10px;border:2px dashed #6f5a9a;border-radius:999px;color:#5b4d66;font-size:14px`)}>Premiere · soon</span>
                </div>
              </div>
              <div style={css(`padding:16px 18px;border:2px solid #3b2d43;border-radius:16px;background:#fffdf8;box-shadow:3px 3px 0 #3b2d43;display:flex;flex-direction:column;gap:8px`)}>
                <span style={css(`font:800 17px 'Baloo 2',sans-serif`)}>Lives in your menu bar</span>
                <span style={css(`font-size:15px;line-height:1.45;color:#5b4d66`)}>Or the system tray. It keeps working when the window is closed, tells you when it needs you, and never jumps in front of your work.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="look" ref={v.deckRef} aria-labelledby="look-title" style={css(`border-bottom:2px solid #3b2d43;background:#f4efe6;overflow:hidden`)}>
        <div style={css(`max-width:1180px;margin:0 auto;padding:clamp(72px,10vw,120px) 24px;display:flex;flex-direction:column;gap:48px;align-items:center;text-align:center`)}>
          <div data-reveal="0" style={css(`display:flex;flex-direction:column;gap:14px;align-items:center;max-width:680px`)}>
            <div style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#5b4d66`)}>
              <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
                <span>Reusable across videos</span>
            </div>
            <h2 id="look-title" style={css(`margin:0;font:800 clamp(34px,5vw,58px)/1 'Baloo 2',sans-serif;letter-spacing:-.025em`)}>Your look, every time</h2>
            <p style={css(`margin:0;font-size:19px;line-height:1.5;color:#5b4d66;text-wrap:pretty`)}>Keep what makes your videos yours and bring it to the next one.</p>
          </div>
          {v.wide && (<>
            <div onMouseEnter={v.deckEnter} onMouseLeave={v.deckLeave} style={css(`position:relative;width:100%;height:400px`)}>
              {v.cards.map((cd, _cd) => (<React.Fragment key={_cd}>
                <div style={css(`position:absolute;left:50%;top:20px;width:280px;margin-left:-140px;height:350px;display:flex;flex-direction:column;background:#fffdf8;border:2px solid #3b2d43;border-radius:20px;box-shadow:6px 6px 0 #3b2d43;overflow:hidden;text-align:left;z-index:${cd.z};transform:${cd.tf};transition:transform .7s cubic-bezier(.2,1.2,.3,1)`)}>
                  <div style={css(`position:relative;height:150px;border-bottom:2px solid #3b2d43;background:${cd.band};overflow:hidden`)}>
                    <span style={css(`position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(59,45,67,.09) 3px 4px)`)}></span>
                    <span style={css(`position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border:3px solid #3b2d43;background:#fffdf8;border-radius:${cd.radius};transform:${cd.shapeTf};box-shadow:0 0 28px rgba(255,253,248,.9)`)}></span>
                  </div>
                  <div style={css(`padding:20px 22px;display:flex;flex-direction:column;gap:8px`)}>
                    <span style={css(`font:500 12px 'Fira Code',monospace;color:#6f5a9a`)}>{cd.tag}</span>
                    <span style={css(`font:800 28px/1 'Baloo 2',sans-serif`)}>{cd.title}</span>
                    <span style={css(`font-size:16px;line-height:1.45;color:#5b4d66`)}>{cd.line}</span>
                  </div>
                </div>
              </React.Fragment>))}
            </div>
          </>)}
          {v.narrow && (<>
            <div style={css(`display:flex;flex-direction:column;gap:20px;width:100%;max-width:340px`)}>
              {v.cards.map((cd, _cd) => (<React.Fragment key={_cd}>
                <div data-reveal="0" style={css(`display:flex;flex-direction:column;background:#fffdf8;border:2px solid #3b2d43;border-radius:20px;box-shadow:6px 6px 0 #3b2d43;overflow:hidden;text-align:left`)}>
                  <div style={css(`position:relative;height:110px;border-bottom:2px solid #3b2d43;background:${cd.band}`)}>
                    <span style={css(`position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border:3px solid #3b2d43;background:#fffdf8;border-radius:${cd.radius};transform:${cd.shapeTf}`)}></span>
                  </div>
                  <div style={css(`padding:18px 20px;display:flex;flex-direction:column;gap:8px`)}>
                    <span style={css(`font:500 12px 'Fira Code',monospace;color:#6f5a9a`)}>{cd.tag}</span>
                    <span style={css(`font:800 26px/1 'Baloo 2',sans-serif`)}>{cd.title}</span>
                    <span style={css(`font-size:16px;line-height:1.45;color:#5b4d66`)}>{cd.line}</span>
                  </div>
                </div>
              </React.Fragment>))}
            </div>
          </>)}
        </div>
      </section>

      <section id="private" ref={v.localRef} aria-labelledby="private-title" style={css(`border-bottom:2px solid #3b2d43;background:#efe7d9`)}>
        <div style={css(`max-width:1180px;margin:0 auto;padding:clamp(72px,10vw,120px) 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:clamp(40px,6vw,72px);align-items:center`)}>
          <div style={css(`display:flex;flex-direction:column;gap:28px`)}>
            <div data-reveal="0" style={css(`display:flex;flex-direction:column;gap:14px`)}>
              <div style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#5b4d66`)}>
                <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
                <span>Local-first</span>
              </div>
              <h2 id="private-title" style={css(`margin:0;font:800 clamp(34px,5vw,58px)/1 'Baloo 2',sans-serif;letter-spacing:-.025em`)}>Local and private</h2>
            </div>
            <div style={css(`display:flex;flex-direction:column;gap:16px`)}>
              <div data-reveal="60" style={css(`padding:16px 20px;border:2px solid #3b2d43;border-radius:16px;background:#fffdf8;box-shadow:3px 3px 0 #3b2d43;font-size:18px;line-height:1.45`)}>Your footage and projects stay on your computer.</div>
              <div data-reveal="120" style={css(`padding:16px 20px;border:2px solid #3b2d43;border-radius:16px;background:#fffdf8;box-shadow:3px 3px 0 #3b2d43;font-size:18px;line-height:1.45`)}>It uses the Codex or Claude Code account you already have, with your own sign-in.</div>
              <div data-reveal="180" style={css(`padding:16px 20px;border:2px solid #3b2d43;border-radius:16px;background:#fffdf8;box-shadow:3px 3px 0 #3b2d43;font-size:18px;line-height:1.45`)}>Nothing asks for your passwords.</div>
            </div>
          </div>
          <div data-reveal="100" aria-hidden="true" style={css(`position:relative;display:flex;justify-content:center;padding:48px 20px 40px;border:2px dashed #6f5a9a;border-radius:28px`)}>
            <span style={css(`position:absolute;left:18px;top:-13px;padding:2px 10px;background:#efe7d9;font:500 13px 'Fira Code',monospace;color:#6f5a9a`)}>your computer</span>
            <span data-float="0" style={css(`position:absolute;left:8%;top:18%;padding:6px 10px;border:2px solid #3b2d43;border-radius:9px;background:#fffdf8;font:500 12px 'Fira Code',monospace;box-shadow:2px 2px 0 #3b2d43`)}>footage/</span>
            <span data-float="1" style={css(`position:absolute;right:6%;top:12%;padding:6px 10px;border:2px solid #3b2d43;border-radius:9px;background:#fffdf8;font:500 12px 'Fira Code',monospace;box-shadow:2px 2px 0 #3b2d43`)}>projects/</span>
            <div style={css(`position:relative;display:flex;flex-direction:column;align-items:center`)}>
              <span style={css(`position:absolute;inset:-10% -14%;border-radius:50%;background:radial-gradient(closest-side,rgba(183,164,214,.7),transparent);filter:blur(10px)`)}></span>
              <div style={css(`position:relative;width:min(260px,62vw);aspect-ratio:3/2.1;background:#3b2d43;border-radius:18px;padding:16px;box-shadow:6px 6px 0 rgba(59,45,67,.25)`)}>
                <div style={css(`position:relative;width:100%;height:100%;border-radius:10px;overflow:hidden;background:#b7a4d6`)}>
                  <span style={css(`position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(59,45,67,.13) 3px 5px)`)}></span>
                  <span style={css(`position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(255,253,248,.3),transparent 60%)`)}></span>
                  <div ref={v.miniEyesRef} style={css(`position:absolute;inset:0;transform-origin:50% 42%`)}>
                    <span style={css(`position:absolute;left:30%;top:32%;width:11%;height:17%;background:#3b2d43`)}></span>
                    <span style={css(`position:absolute;right:30%;top:32%;width:11%;height:17%;background:#3b2d43`)}></span>
                  </div>
                  <span style={css(`position:absolute;left:42%;top:58%;width:16%;height:12%;border-bottom:4px solid #3b2d43;border-radius:0 0 50% 50%`)}></span>
                </div>
              </div>
              <span style={css(`width:34px;height:26px;background:#3b2d43`)}></span>
              <span style={css(`width:130px;height:14px;background:#3b2d43;border-radius:7px`)}></span>
              <div style={css(`position:absolute;right:-30px;bottom:18px;display:flex;flex-direction:column;align-items:center`)}>
                <span ref={v.shackleRef} style={css(`width:40px;height:34px;border:7px solid #3b2d43;border-bottom:0;border-radius:20px 20px 0 0;margin-bottom:-2px`)}></span>
                <span style={css(`position:relative;width:62px;height:50px;border:3px solid #3b2d43;border-radius:12px;background:#e7b86a;box-shadow:3px 3px 0 #3b2d43`)}>
                  <span style={css(`position:absolute;left:50%;top:13px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#3b2d43`)}></span>
                  <span style={css(`position:absolute;left:50%;top:20px;width:6px;height:14px;margin-left:-3px;background:#3b2d43;border-radius:2px`)}></span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" style={css(`border-bottom:2px solid #3b2d43;background:#f4efe6`)}>
        <div style={css(`max-width:1180px;margin:0 auto;padding:clamp(72px,10vw,120px) 24px;display:flex;flex-wrap:wrap;gap:clamp(32px,5vw,64px);align-items:flex-start`)}>
          <div data-reveal="0" style={css(`flex:1 1 280px;display:flex;flex-direction:column;gap:14px`)}>
            <div style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#5b4d66`)}>
              <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
              <span>Questions</span>
            </div>
            <h2 id="faq-title" style={css(`margin:0;font:800 clamp(34px,5vw,58px)/1 'Baloo 2',sans-serif;letter-spacing:-.025em`)}>Good to know</h2>
          </div>
          <div data-reveal="80" style={css(`flex:2 1 460px;display:flex;flex-direction:column;gap:12px;min-width:0`)}>
            {v.faq.map(f => (
              <details key={f.q} className="faq" style={css(`border:2px solid #3b2d43;border-radius:14px;background:#fffdf8;box-shadow:3px 3px 0 #3b2d43`)}>
                <summary style={css(`display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px 16px 20px;cursor:pointer;font:800 19px/1.25 'Baloo 2',sans-serif;color:#3b2d43`)}>
                  {f.q}
                  <span aria-hidden="true" className="faq-icon" style={css(`position:relative;flex:none;width:24px;height:24px;border:2px solid #3b2d43;border-radius:7px;background:#e7b86a`)}>
                    <span style={css(`position:absolute;left:4px;right:4px;top:50%;height:2px;margin-top:-1px;background:#3b2d43`)}></span>
                    <span style={css(`position:absolute;top:4px;bottom:4px;left:50%;width:2px;margin-left:-1px;background:#3b2d43`)}></span>
                  </span>
                </summary>
                <p style={css(`margin:0;padding:0 20px 18px;font-size:17px;line-height:1.55;color:#5b4d66;max-width:62ch`)}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="get-started" ref={v.checkRef} aria-labelledby="start-title" style={css(`position:relative;overflow:hidden;background:#f4efe6`)}>
        <span aria-hidden="true" style={css(`position:absolute;left:50%;top:0;width:900px;height:600px;margin-left:-450px;border-radius:50%;background:radial-gradient(closest-side,rgba(183,164,214,.4),transparent);pointer-events:none`)}></span>
        <div style={css(`position:relative;max-width:1180px;margin:0 auto;padding:clamp(72px,10vw,120px) 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:clamp(40px,6vw,72px);align-items:center`)}>
          <div style={css(`display:flex;flex-direction:column;gap:24px`)}>
            <div data-reveal="0" style={css(`display:flex;flex-direction:column;gap:14px`)}>
              <div style={css(`display:flex;align-items:center;gap:10px;font:500 13px 'Fira Code',monospace;color:#5b4d66`)}>
                <span style={css(`display:flex;gap:5px`)}><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#b7a4d6;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#7fb7a8;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#e7b86a;border:1.5px solid #3b2d43`)}></span><span data-pulse="" style={css(`width:9px;height:9px;border-radius:2px;background:#a3405c;border:1.5px solid #3b2d43`)}></span></span>
                <span>Download</span>
              </div>
              <h2 id="start-title" style={css(`margin:0;font:800 clamp(40px,6vw,72px)/1 'Baloo 2',sans-serif;letter-spacing:-.03em`)}>Get started</h2>
              <p style={css(`margin:0;font-size:19px;line-height:1.5;color:#5b4d66`)}>Install it, open it, and it checks your setup for you.</p>
            </div>
            <div data-reveal="80">{this.downloads(v)}</div>
            <div data-reveal="140" style={css(`display:flex;align-items:center;gap:10px;font:500 14px 'Fira Code',monospace;color:#2f6b5e`)}>
              <span style={css(`width:10px;height:10px;border-radius:50%;background:#7fb7a8;border:2px solid #3b2d43`)}></span>Checks for updates on its own
            </div>
            <details data-reveal="180" className="first-launch" style={css(`max-width:54ch;font-size:15px;line-height:1.5;color:#5b4d66`)}>
              <summary style={css(`cursor:pointer;font:700 16px 'Baloo 2',sans-serif;color:#3b2d43`)}>Seeing a security warning the first time you open it?</summary>
              <div style={css(`display:flex;flex-direction:column;gap:8px;padding-top:10px`)}>
                <p style={css(`margin:0`)}><strong>Mac:</strong> open System Settings, go to Privacy &amp; Security, and click <strong>Open Anyway</strong> next to the message about Phosphor.</p>
                <p style={css(`margin:0`)}><strong>Windows:</strong> if SmartScreen stops the installer, click <strong>More info</strong>, then <strong>Run anyway</strong>.</p>
                <p style={css(`margin:0`)}>You only need to do this once.</p>
              </div>
            </details>
          </div>
          <div data-reveal="100" style={css(`padding:clamp(20px,3vw,32px);background:#fffdf8;border:2px solid #3b2d43;border-radius:20px;box-shadow:6px 6px 0 #3b2d43;display:flex;flex-direction:column;gap:18px`)}>
            <span style={css(`font:800 22px 'Baloo 2',sans-serif`)}>What you need</span>
            <ul style={css(`list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px`)}>
              {v.checklist.map((it, _it) => (<React.Fragment key={_it}>
                <li style={css(`display:flex;gap:14px;align-items:flex-start`)}>
                  <span style={css(`position:relative;width:28px;height:28px;flex:none;border:2px solid #3b2d43;border-radius:8px;background:#fffdf8;overflow:hidden`)}>
                    <span style={css(`position:absolute;inset:0;background:#7fb7a8;opacity:${it.op};transition:opacity .25s`)}></span>
                    <span style={css(`position:absolute;left:8px;top:3px;width:8px;height:14px;border-right:3px solid #3b2d43;border-bottom:3px solid #3b2d43;transform:${it.tf};transition:transform .35s cubic-bezier(.2,1.6,.4,1)`)}></span>
                  </span>
                  <span style={css(`font-size:17px;line-height:1.45;padding-top:1px`)}>{it.t}</span>
                </li>
              </React.Fragment>))}
            </ul>
            <span style={css(`font-size:15px;line-height:1.45;color:#5b4d66;padding-top:14px;border-top:2px dashed #b7a4d6`)}>Phosphor checks for these and tells you what's missing.</span>
          </div>
        </div>
      </section>

      </main>

      <footer style={css(`border-top:2px solid #3b2d43;background:#3b2d43;color:#fffdf8`)}>
        <div style={css(`max-width:1180px;margin:0 auto;padding:36px 24px;display:flex;flex-wrap:wrap;align-items:center;gap:20px 32px`)}>
          <div style={css(`display:flex;align-items:center;gap:12px`)}>
            <span aria-hidden="true" style={css(`display:grid;grid-template-columns:repeat(12,4px);grid-auto-rows:4px;box-shadow:0 0 18px rgba(183,164,214,.55)`)}>
              {v.footPixels.map((p, _p) => (<React.Fragment key={_p}><span style={css(`background:${p.c}`)}></span></React.Fragment>))}
            </span>
            <span style={css(`font:800 26px/1 'Baloo 2',sans-serif;padding-top:3px`)}>Phosphor</span>
          </div>
          <a href="https://github.com/elebumm/phosphor-releases/releases" style={css(`color:#dcd2ee;font:700 16px 'Baloo 2',sans-serif`)} className="footer-link">Releases on GitHub</a>
          <span style={css(`margin-left:auto;font:400 13px 'Fira Code',monospace;color:#dcd2ee`)}>© {v.year} Phosphor</span>
        </div>
      </footer>

      </div>
    );
  }
}
