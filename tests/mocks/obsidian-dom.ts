/**
 * Obsidian DOM helper mocks for jsdom-based UI tests.
 *
 * At runtime Obsidian extends HTMLElement.prototype with convenience
 * helpers (createDiv, createEl, createSpan, empty, setText, addClass,
 * removeClass) and exposes a global createDiv. This module mirrors the
 * subset actually used by src/ui so render tests can run under jsdom.
 *
 * No-op when no DOM is present (node-environment tests are untouched).
 * Opt in per test file with: /** @jest-environment jsdom *\/
 */

export interface DomElementInfo {
  cls?: string | string[];
  text?: string;
  value?: string;
  attr?: Record<string, string>;
}

function applyInfo(el: HTMLElement, info?: DomElementInfo | string): void {
  if (!info) return;
  if (typeof info === 'string') {
    el.classList.add(...info.split(' '));
    return;
  }
  if (info.cls) {
    const classes = Array.isArray(info.cls) ? info.cls : info.cls.split(' ');
    el.classList.add(...classes);
  }
  if (info.text !== undefined) {
    el.textContent = info.text;
  }
  if (info.value !== undefined && 'value' in el) {
    (el as HTMLElement & { value: string }).value = info.value;
  }
  if (info.attr) {
    for (const [key, val] of Object.entries(info.attr)) {
      el.setAttribute(key, val);
    }
  }
}

export function installObsidianDomHelpers(): void {
  if (typeof document === 'undefined') return;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const proto = HTMLElement.prototype as any;

  proto.createEl = function (tag: string, info?: DomElementInfo | string): HTMLElement {
    const el = document.createElement(tag);
    applyInfo(el, info);
    this.appendChild(el);
    return el;
  };

  proto.createDiv = function (info?: DomElementInfo | string): HTMLElement {
    return this.createEl('div', info);
  };

  proto.createSpan = function (info?: DomElementInfo | string): HTMLElement {
    return this.createEl('span', info);
  };

  proto.empty = function (): void {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
  };

  proto.setText = function (text: string): void {
    this.textContent = text;
  };

  proto.addClass = function (...classes: string[]): void {
    this.classList.add(...classes);
  };

  proto.removeClass = function (...classes: string[]): void {
    this.classList.remove(...classes);
  };

  // Obsidian exposes a global createDiv (used for detached elements)
  (global as any).createDiv = (info?: DomElementInfo | string): HTMLElement => {
    const el = document.createElement('div');
    applyInfo(el, info);
    return el;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

installObsidianDomHelpers();
