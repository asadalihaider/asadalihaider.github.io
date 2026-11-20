import './style.css';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stages = [...document.querySelectorAll('.stage')];
const layersDom = stages.map((s) => s.querySelector('.layer'));
const navLinks = [...document.querySelectorAll('[data-nav]')].map((a) => { const [lo, hi = lo] = a.dataset.nav.split('-').map(Number); return { a, lo, hi }; });
const band = document.querySelector('.band');
const labels = [...document.querySelectorAll('[data-label]')];

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// ---------- scroll position as a stage number, 0 to 4 ----------
let tops = [];
function measure() { tops = stages.map((s) => s.offsetTop); tops[tops.length - 1] = Math.max(tops[tops.length - 1], root.scrollHeight - innerHeight); }
function stageFromScroll() {
  const y = scrollY;
  for (let i = 0; i < tops.length - 1; i++) {
    if (y < tops[i + 1]) return i + Math.max(0, (y - tops[i]) / (tops[i + 1] - tops[i]));
  }
  return tops.length - 1;
}

function setVisibility(s) {
  layersDom.forEach((el, i) => {
    const d = Math.abs(s - i);
    const vis = Math.max(0, Math.min(1, 1 - (d - 0.16) / 0.3));
    el.style.setProperty('--vis', vis.toFixed(3));
    el.classList.toggle('is-live', vis > 0.01);
    const on = vis > 0.5;
    if (el.classList.contains('is-on') !== on) { el.classList.toggle('is-on', on); el.inert = !on; }
  });
  if (band) band.style.setProperty('--vis-band', Math.max(0, Math.min(1, (s - 6.55) / 0.3)).toFixed(3));
  const active = Math.round(s);
  navLinks.forEach(({ a, lo, hi }) => (active >= lo && active <= hi ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
}

// ---------- start ----------
async function start() {
  if (!webglOK()) return;
  const { createScene } = await import('./scene.js');
  root.classList.add('webgl');
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  const sc = createScene(document.querySelector('.scene'), { reduced });
  const tick = () => {
    const target = stageFromScroll();
    const { s } = sc.frame(target);
    setVisibility(reduced ? target : s);
    if (s > 0.55 && s < 1.6) {
      labels.forEach((li) => {
        const p = sc.layerEdge(+li.dataset.label, li.dataset.side);
        const off = li.dataset.side === 'right' ? 28 : -28;
        li.style.setProperty('--x', `${(p.x + off).toFixed(1)}px`);
        li.style.setProperty('--y', `${p.y.toFixed(1)}px`);
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
start();

// ---------- artisan palette ----------
const UPWORK = 'https://www.upwork.com/freelancers/~0152c5ac8c2d1c1e1a';
const commands = [
  { cmd: 'php artisan about', desc: 'Who I am, in 30 seconds', go: '#hello' },
  { cmd: 'php artisan stack:explode', desc: 'Take the stack apart', go: '#stack' },
  { cmd: 'php artisan case city-care-lab', desc: 'The multi-tenant lab SaaS', go: '#cases' },
  { cmd: 'php artisan case marineparts', desc: 'The Laravel and Lunar store', go: '#case-marineparts' },
  { cmd: 'php artisan case game-apis', desc: 'Node.js APIs for games', go: '#case-games' },
  { cmd: 'php artisan case hybrid-rag', desc: 'Search that cites its sources', go: '#case-rag' },
  { cmd: 'php artisan deploy', desc: 'How I ship and run apps', go: '#ship' },
  { cmd: 'php artisan cv:download', desc: 'My CV as a PDF', href: './cv.pdf' },
  { cmd: 'php artisan contact', desc: 'Start a project', go: '#contact' },
  { cmd: 'php artisan projects:list', desc: 'All projects on Upwork', href: UPWORK },
];
const dlg = document.querySelector('.palette');
const input = dlg.querySelector('input');
const list = dlg.querySelector('.palette-list');
const count = dlg.querySelector('.palette-count');
let shown = commands, sel = 0;

function render() {
  const q = input.value.toLowerCase().replace(/^php artisan\s*/, '').trim();
  shown = commands.filter((c) => !q || c.cmd.includes(q) || c.desc.toLowerCase().includes(q));
  sel = Math.min(sel, Math.max(0, shown.length - 1));
  list.replaceChildren(...shown.map((c, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(i === sel));
    const code = document.createElement('code'); code.textContent = c.cmd;
    const span = document.createElement('span'); span.textContent = c.desc;
    b.append(code, span);
    b.addEventListener('click', () => run(c));
    b.addEventListener('pointerenter', () => { sel = i; mark(); });
    li.append(b); return li;
  }));
  count.textContent = `${shown.length} ${shown.length === 1 ? 'command' : 'commands'}`;
}
function mark() { [...list.querySelectorAll('button')].forEach((b, i) => b.setAttribute('aria-selected', String(i === sel))); }
function run(c) {
  dlg.close();
  if (c.href) { location.href = c.href; return; }
  document.querySelector(c.go)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
function open() { input.value = 'php artisan '; sel = 0; render(); dlg.showModal(); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }

input.addEventListener('input', () => { sel = 0; render(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) run(shown[sel]); }
});
document.querySelectorAll('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? dlg.close() : open(); }
});
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
