// Match win/lose screen with a replay button. (Round-to-round transitions use the
// lighter HUD banner; this is the end-of-match screen.)
import { HUMAN_TEAM } from '../sim/config';
import type { GameState } from '../sim/types';
import { clear, el } from './dom';

export class Results {
  readonly root: HTMLElement;

  constructor(private onReplay: () => void, private onMenu: () => void) {
    this.root = el('div', { class: 'screen hidden' });
  }

  hide(): void { this.root.classList.add('hidden'); }

  showMatch(state: GameState): void {
    const won = state.matchWinner === HUMAN_TEAM;
    clear(this.root);
    this.root.append(
      el('div', { class: 'subtitle', text: won ? 'ai câștigat cartierul' : 'altă dată, campionule' }),
      el('h1', { class: 'title', text: won ? 'VICTORIE!' : 'ÎNFRÂNGERE' }),
      el('div', { class: 'note', text: `Scor final  —  TU ${state.scores[HUMAN_TEAM]} : ${state.scores[HUMAN_TEAM === 'A' ? 'B' : 'A']} EI` }),
      el('button', { class: 'btn', text: 'MAI JOACĂ', onclick: () => this.onReplay() }),
      el('button', { class: 'btn secondary', text: 'Alt cartier', onclick: () => this.onMenu() }),
    );
    this.root.classList.remove('hidden');
  }
}
