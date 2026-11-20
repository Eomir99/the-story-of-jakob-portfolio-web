// Standalone portfolio: one content page, with an optional game-ending overlay.
import { PROJECTS } from './portfolio-projects.js';

const root = document.querySelector('#portfolio');
const track = root.querySelector('.pf-track');
const sections = [...root.querySelectorAll('[data-section]')];
const intro = document.querySelector('#game-intro');
const explore = document.querySelector('#explore-portfolio');
const projectDialog = document.querySelector('#project-dialog');
const screenshotDialog = document.querySelector('#screenshot-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ids = sections.map(section => section.id);
let index = 0;
let lastMove = -Infinity;
let introOpen = document.documentElement.classList.contains('from-game');
let leavingIntro = false;
let projectIndex = null;
let screenshotIndex = 0;
let touchY = null;
let touchTarget = null;
let projectOpener = null;

function go(next, { immediate = false, updateUrl = true, focus = false } = {}) {
  next = Math.max(0, Math.min(sections.length - 1, next));
  if (!immediate && performance.now() - lastMove < 950) return;
  if (next !== index) lastMove = performance.now();
  const previous = sections[index];
  if (focus || previous.contains(document.activeElement)) root.focus({ preventScroll: true });
  index = next;
  root.dataset.activeSection = ids[index];
  track.style.transform = `translateY(-${index * 100}%)`;
  sections.forEach((section, i) => {
    section.inert = i !== index;
    section.setAttribute('aria-hidden', String(i !== index));
    const reveal = section.querySelector('.pf-reveal');
    reveal.style.opacity = i === index ? '1' : '0';
    reveal.style.transform = `translateY(${i === index ? 0 : i < index ? -40 : 40}px)`;
  });
  root.querySelectorAll('[data-go]').forEach(button => {
    const target = Number(button.dataset.go);
    const active = target === index || (target === 2 && index === 3 && button.classList.contains('pf-nav'));
    button.setAttribute('aria-current', String(active));
  });
  if (updateUrl && !introOpen) history.replaceState(null, '', `#${ids[index]}`);
}

function canScroll(target, direction) {
  const section = target?.closest?.('[data-section]') ?? sections[index];
  if (section.scrollHeight <= section.clientHeight + 2) return false;
  return direction > 0
    ? section.scrollTop + section.clientHeight < section.scrollHeight - 2
    : section.scrollTop > 2;
}

function enterPortfolio() {
  if (!introOpen || leavingIntro) return;
  leavingIntro = true;
  document.documentElement.classList.add('intro-leaving');
  explore.disabled = true;
  const finish = () => {
    if (!introOpen) return;
    introOpen = false;
    intro.hidden = true;
    intro.inert = true;
    root.inert = false;
    document.documentElement.classList.remove('from-game', 'intro-leaving');
    const url = new URL(location.href);
    url.searchParams.delete('from');
    url.hash = 'home';
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    root.focus({ preventScroll: true });
  };
  intro.addEventListener('transitionend', event => {
    if (event.target === intro && event.propertyName === 'transform') finish();
  }, { once: true });
  // Fallback also handles reduced motion or a tab hidden during the transition.
  const duration = parseFloat(getComputedStyle(intro).transitionDuration) * 1000;
  setTimeout(finish, reducedMotion.matches ? 0 : duration + 80);
}

root.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => {
  go(Number(button.dataset.go), { immediate: true });
}));
root.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
  go(index + 1, { immediate: true, focus: true });
}));
explore.addEventListener('click', enterPortfolio);

function showScreenshot(next) {
  const shots = PROJECTS[projectIndex].shots;
  screenshotIndex = (next + shots.length) % shots.length;
  const shot = shots[screenshotIndex];
  const image = document.querySelector('#enlarged-screenshot');
  image.src = shot.url;
  image.alt = shot.label;
  document.querySelector('#screenshot-caption').textContent = `${shot.label} · ${screenshotIndex + 1} / ${shots.length}`;
}

function openProject(i, opener) {
  projectIndex = i;
  projectOpener = opener;
  const project = PROJECTS[i];
  document.querySelector('#project-title').textContent = project.title;
  document.querySelector('#project-kind').textContent = project.kind;
  document.querySelector('#project-status').textContent = project.status;
  document.querySelector('#project-description').replaceChildren(...project.body.map(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));
  const gallery = document.querySelector('#project-shots');
  gallery.replaceChildren(...project.shots.map((shot, n) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pf-shot';
    button.setAttribute('aria-label', `Enlarge screenshot: ${shot.label}`);
    const image = document.createElement('img');
    image.src = shot.url;
    image.alt = shot.label;
    image.loading = 'lazy';
    image.decoding = 'async';
    button.append(image);
    button.addEventListener('click', () => {
      showScreenshot(n);
      screenshotDialog.showModal();
      screenshotDialog.querySelector('[data-close-screenshot]').focus();
    });
    return button;
  }));
  document.querySelector('#play-game').hidden = !project.game;
  projectDialog.showModal();
  projectDialog.scrollTop = 0;
  projectDialog.querySelector('[data-close-project]').focus();
}
root.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
  openProject(Number(button.dataset.project), button);
}));
projectDialog.querySelector('[data-close-project]').addEventListener('click', () => projectDialog.close());
screenshotDialog.querySelector('[data-close-screenshot]').addEventListener('click', () => screenshotDialog.close());
projectDialog.addEventListener('close', () => {
  projectIndex = null;
  projectOpener?.focus({ preventScroll: true });
});
for (const dialog of [projectDialog, screenshotDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
}
document.querySelector('#previous-screenshot').addEventListener('click', () => showScreenshot(screenshotIndex - 1));
document.querySelector('#next-screenshot').addEventListener('click', () => showScreenshot(screenshotIndex + 1));

document.addEventListener('keydown', event => {
  const key = event.key;
  const activeDialog = screenshotDialog.open ? screenshotDialog : projectDialog.open ? projectDialog : null;
  // Keep keyboard focus in the topmost gallery layer, including nested dialogs.
  if (key === 'Tab' && activeDialog) {
    const controls = [...activeDialog.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    if (controls.length) {
      event.preventDefault();
      const current = controls.indexOf(document.activeElement);
      const next = current < 0 ? 0 : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[next].focus();
    }
    return;
  }
  if (screenshotDialog.open) {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      showScreenshot(screenshotIndex + (key === 'ArrowRight' ? 1 : -1));
    }
    return; // Native dialog handles Escape and keeps focus inside the viewer.
  }
  if (projectDialog.open) return;
  if (introOpen) {
    if (['Enter', ' ', 'ArrowDown', 'PageDown'].includes(key)) {
      event.preventDefault();
      enterPortfolio();
    }
    return;
  }
  const control = event.target.closest?.('button, a, input, select, textarea');
  if (control && ['Enter', ' '].includes(key)) return;
  const direction = ['Enter', ' ', 'ArrowDown', 'PageDown'].includes(key) ? 1
    : ['ArrowUp', 'PageUp'].includes(key) ? -1 : 0;
  if (direction) {
    if (canScroll(event.target, direction)) {
      event.preventDefault();
      sections[index].scrollBy({ top: direction * sections[index].clientHeight * .75, behavior: reducedMotion.matches ? "instant" : "smooth" });
      return;
    }
    event.preventDefault();
    go(index + direction, { focus: true });
  } else if (key === 'Home' || key === 'End') {
    event.preventDefault();
    go(key === 'Home' ? 0 : sections.length - 1, { immediate: true, focus: true });
  }
});
root.addEventListener('wheel', event => {
  if (introOpen || projectDialog.open || Math.abs(event.deltaY) < 24) return;
  const direction = event.deltaY > 0 ? 1 : -1;
  if (canScroll(event.target, direction)) return;
  event.preventDefault();
  go(index + direction);
}, { passive: false });
intro.addEventListener('wheel', event => {
  if (event.deltaY > 24) { event.preventDefault(); enterPortfolio(); }
}, { passive: false });
for (const surface of [root, intro]) {
  surface.addEventListener('touchstart', event => {
    touchY = event.touches[0]?.clientY ?? null;
    touchTarget = event.target;
  }, { passive: true });
  surface.addEventListener('touchend', event => {
    if (touchY === null || !event.changedTouches[0] || projectDialog.open) return;
    const distance = touchY - event.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(distance) < 50) return;
    if (introOpen) { if (distance > 0) enterPortfolio(); return; }
    const direction = distance > 0 ? 1 : -1;
    if (!canScroll(touchTarget, direction)) go(index + direction);
  }, { passive: true });
}
window.addEventListener('hashchange', () => {
  const target = ids.indexOf(location.hash.slice(1));
  if (target >= 0 && !introOpen) go(target, { immediate: true, updateUrl: false });
});
const initial = ids.indexOf(location.hash.slice(1));
go(introOpen || initial < 0 ? 0 : initial, { immediate: true, updateUrl: false });
root.inert = introOpen;
intro.inert = !introOpen;
if (introOpen) explore.focus({ preventScroll: true });
else { intro.hidden = true; root.focus({ preventScroll: true }); }
