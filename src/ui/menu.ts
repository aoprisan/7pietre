// NEIGHBORHOOD SELECT -> START. The menu is structured around neighborhoods even
// though play is offline: this shape won't need to change when real rooms arrive.
import { DIFFICULTIES, NEIGHBORHOODS, type Difficulty, type Neighborhood } from '../sim/config';
import { clear, el } from './dom';

export interface MenuChoice {
  neighborhood: Neighborhood;
  difficulty: Difficulty;
}

export class Menu {
  readonly root: HTMLElement;
  private selectedHood = NEIGHBORHOODS[0];
  private selectedDiff = DIFFICULTIES[1];

  constructor(private onStart: (c: MenuChoice) => void) {
    this.root = el('div', { class: 'screen' });
    this.build();
  }

  setHighScore(wins: number): void {
    const note = this.root.querySelector('.hs');
    if (note) note.innerHTML = wins > 0
      ? `Meciuri câștigate pe acest telefon: <span class="hi">${wins}</span>`
      : 'Primul tău meci în cartier.';
  }

  show(): void { this.root.classList.remove('hidden'); }
  hide(): void { this.root.classList.add('hidden'); }

  private build(): void {
    clear(this.root);
    this.root.append(
      el('div', { class: 'subtitle', text: 'joc de cartier' }),
      el('h1', { class: 'title', text: '7 PIETRE' }),
      el('div', { class: 'section-label', text: 'Alege cartierul' }),
      this.hoodCards(),
      el('div', { class: 'section-label', text: 'Dificultate' }),
      this.diffSegmented(),
      el('button', { class: 'btn', text: 'JOACĂ', onclick: () => this.onStart({ neighborhood: this.selectedHood, difficulty: this.selectedDiff }) }),
      el('div', { class: 'note hs', text: '' }),
      el('div', { class: 'note', text: 'Dărâmă castelul de 7 pietre, apoi reconstruiește-l fugind de minge. Best of 5.' }),
    );
  }

  private hoodCards(): HTMLElement {
    const wrap = el('div', { class: 'cards' });
    for (const h of NEIGHBORHOODS) {
      const card = el('div', { class: 'card' + (h.id === this.selectedHood.id ? ' selected' : '') }, [
        el('span', { class: 'tag', text: h.subtitle }),
        el('span', { class: 'name', text: h.name }),
        el('span', { class: 'desc', text: h.desc }),
      ]);
      card.onclick = () => {
        this.selectedHood = h;
        wrap.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
      };
      wrap.append(card);
    }
    return wrap;
  }

  private diffSegmented(): HTMLElement {
    const wrap = el('div', { class: 'segmented' });
    for (const d of DIFFICULTIES) {
      const b = el('button', { text: d.label, class: d.key === this.selectedDiff.key ? 'selected' : '' });
      b.onclick = () => {
        this.selectedDiff = d;
        wrap.querySelectorAll('button').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
      };
      wrap.append(b);
    }
    return wrap;
  }
}
