// Minimal DOM helper — no framework, zero deps.
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string; text?: string } = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, text, ...rest } = props as Record<string, unknown>;
  if (cls) node.className = cls as string;
  if (text != null) node.textContent = text as string;
  Object.assign(node, rest);
  for (const c of children) node.append(c as Node | string);
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
