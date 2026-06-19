// Top score/timer bar + center banner + bottom contextual prompt. Pure DOM,
// updated each frame from read-only game state.
import { HUMAN_TEAM, MATCH_WINS_NEEDED } from '../sim/config';
import type { GameState, Team } from '../sim/types';
import { el } from './dom';

const PHASE_LABEL: Record<string, string> = {
  siege: 'ASEDIU',
  scramble: 'RECONSTRUCȚIE',
  roundEnd: 'RUNDĂ',
  matchEnd: 'MECI',
};

export class Hud {
  readonly root: HTMLElement;
  readonly banner: HTMLElement;
  readonly prompt: HTMLElement;
  private scoreA: HTMLElement;
  private scoreB: HTMLElement;
  private phaseEl: HTMLElement;
  private timerEl: HTMLElement;
  private bannerTimer = 0;

  constructor() {
    this.scoreA = el('div', { class: 'score teamA' });
    this.scoreB = el('div', { class: 'score teamB' });
    this.phaseEl = el('div', { class: 'phase', text: '' });
    this.timerEl = el('div', { class: 'timer', text: '' });
    this.root = el('div', { id: 'hud' }, [
      this.scoreA,
      el('div', { class: 'mid' }, [this.phaseEl, this.timerEl]),
      this.scoreB,
    ]);
    this.banner = el('div', { id: 'banner' });
    this.prompt = el('div', { id: 'prompt' });
  }

  private pips(team: Team, wins: number): (Node | string)[] {
    const out: (Node | string)[] = [];
    const label = team === HUMAN_TEAM ? 'TU' : 'EI';
    out.push(el('span', { text: label }));
    for (let i = 0; i < MATCH_WINS_NEEDED; i++) {
      out.push(el('span', { class: 'pip' + (i < wins ? ' ' + team : '') }));
    }
    return out;
  }

  update(state: GameState): void {
    this.scoreA.replaceChildren(...this.pips('A', state.scores.A));
    this.scoreB.replaceChildren(...this.pips('B', state.scores.B));
    this.phaseEl.textContent = `${PHASE_LABEL[state.phase] ?? ''} · R${state.round}`;

    if (state.phase === 'scramble') {
      const t = Math.max(0, Math.ceil(state.timer));
      this.timerEl.textContent = `${t}s`;
      this.timerEl.classList.toggle('warn', t <= 15);
    } else if (state.phase === 'siege') {
      const total = state.siege.order.length;
      this.timerEl.textContent = `aruncare ${Math.min(state.siege.index + 1, total)}/${total}`;
      this.timerEl.classList.remove('warn');
    } else {
      this.timerEl.textContent = '';
      this.timerEl.classList.remove('warn');
    }
  }

  setPrompt(text: string): void {
    if (this.prompt.textContent !== text) this.prompt.textContent = text;
  }

  showBanner(text: string, seconds = 1.4): void {
    this.banner.textContent = text;
    this.banner.classList.add('show');
    this.bannerTimer = seconds;
  }

  tick(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
  }
}
