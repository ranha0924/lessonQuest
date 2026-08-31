import type { Page } from '@playwright/test';

const surfaceSelectors = [
  '.demo-shell',
  '.demo-toolbar',
  '.demo-navigation',
  '.demo-mission-card',
  '.demo-question-card',
  '.demo-growth-summary',
  '.demo-rasa-companion',
  '.demo-next-session',
  '.boss-card',
  '.rasa-panel',
  '.retry',
  '.pass-stamp',
  '.workbench',
  '.workbench .panel',
];

// Critical task instructions, controls, feedback, progress, and small section labels.
// Decorative SVG/aria-hidden text and disabled controls are not text-contrast targets.
const contrastSelectors = [
  '.demo-toolbar strong',
  '.demo-toolbar button',
  '.demo-brand',
  '.demo-navigation-links a',
  '.demo-student-header .eyebrow',
  '.demo-mission-copy h1',
  '.demo-primary',
  '.demo-growth-summary p',
  '.demo-growth-summary strong',
  '.demo-rasa-companion h2',
  '.demo-rasa-companion p',
  '.demo-next-session h2',
  '.demo-next-session p',
  '.demo-question-card h2',
  '.demo-question-card > p',
  '.demo-question-heading p',
  '.demo-question-heading span',
  '.choice-grid button',
  '.rasa-panel h3',
  '.rasa-panel p',
  '.rasa-panel button',
  '.boss-card h2',
  '.boss-card p',
  '.boss-card strong',
  '.workbench h1',
  '.workbench h2',
  '.workbench p',
];

export interface Violation {
  readonly kind: 'target' | 'overflow' | 'contrast' | 'surface';
  readonly element: string;
  readonly measured: number;
}

export function measureDemo(page: Page) {
  return measureTheme(page, { scope: '.demo-shell', surfaceSelectors, contrastSelectors });
}

export async function measureTheme(
  page: Page,
  options: { scope: string; surfaceSelectors: string[]; contrastSelectors: string[] },
) {
  return page.evaluate(({ scope, surfaceSelectors, contrastSelectors }) => {
    type Color = readonly [number, number, number, number];
    const violations: Violation[] = [];
    const visible = (element: Element) =>
      element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const label = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}.${element.classList.value} ${(element.textContent ?? '').trim().slice(0, 65)}`;
    const parseColor = (value: string): Color => {
      const numbers = value.match(/[\d.]+/g)?.map(Number);
      if (numbers === undefined || numbers.length < 3 || !value.startsWith('rgb')) {
        throw new Error(`Unsupported computed color: ${value}`);
      }
      return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 1];
    };
    const composite = (top: Color, bottom: Color): Color => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
      1,
    ];
    const luminance = (color: Color) => {
      const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      return linear(color[0]) * 0.2126 + linear(color[1]) * 0.7152 + linear(color[2]) * 0.0722;
    };
    const imageLayers = (image: string) => {
      if (image === 'none') return [];
      const layers: string[] = [];
      let depth = 0;
      let start = 0;
      for (let index = 0; index < image.length; index += 1) {
        if (image[index] === '(') depth += 1;
        if (image[index] === ')') depth -= 1;
        if (image[index] === ',' && depth === 0) {
          layers.push(image.slice(start, index));
          start = index + 1;
        }
      }
      layers.push(image.slice(start));
      return layers;
    };
    const backgrounds = (element: Element): Color[] => {
      const ancestors: Element[] = [];
      for (
        let current: Element | null = element;
        current !== null;
        current = current.parentElement
      ) {
        ancestors.unshift(current);
      }
      let colors: Color[] = [[255, 255, 255, 1]];
      for (const ancestor of ancestors) {
        const style = getComputedStyle(ancestor);
        colors = colors.map((color) => composite(parseColor(style.backgroundColor), color));
        // Use every gradient stop, not just backgroundColor. This is a conservative
        // bound across the whole surface, including translucent gradient layers.
        for (const layer of imageLayers(style.backgroundImage).reverse()) {
          if (layer.trim() === 'none') continue;
          const stops = layer.match(/rgba?\([^)]*\)/g);
          if (stops === null || !layer.includes('gradient(')) {
            throw new Error(`Unsupported computed background: ${layer}`);
          }
          colors = colors.flatMap((color) =>
            stops.map((stop) => composite(parseColor(stop), color)),
          );
        }
      }
      return colors;
    };

    const width = document.documentElement.clientWidth;
    for (const element of [
      document.documentElement,
      document.body,
      document.querySelector(scope),
    ]) {
      if (element === null) throw new Error('The synthetic demo is missing');
      if (element.scrollWidth > width + 1) {
        violations.push({
          kind: 'overflow',
          element: label(element),
          measured: element.scrollWidth,
        });
      }
    }
    // Check actual text boxes too: overflow-x:clip must not hide overflowing copy.
    for (const element of document.querySelectorAll(`${scope} *`)) {
      if (!visible(element) || element.closest('[aria-hidden="true"], svg') !== null) continue;
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || node.textContent?.trim() === '') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.left < -1 || rect.right > width + 1) {
            violations.push({ kind: 'overflow', element: label(element), measured: rect.right });
          }
        }
      }
    }

    const targets = [
      ...document.querySelectorAll(
        `${scope} button, ${scope} a[href], ${scope} summary, ${scope} select, ${scope} input:not([type=checkbox]), ${scope} textarea, ${scope} label:has(input[type=checkbox])`,
      ),
    ]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        if (size < 44) violations.push({ kind: 'target', element: label(element), measured: size });
        return { element: label(element), width: rect.width, height: rect.height };
      });
    const surfaces = [...document.querySelectorAll(surfaceSelectors.join(','))]
      .filter(visible)
      .map((element) => {
        const maximum = Math.max(...backgrounds(element).map(luminance));
        if (maximum > 0.22)
          violations.push({ kind: 'surface', element: label(element), measured: maximum });
        return { element: label(element), luminance: maximum };
      });
    const contrasts = [...document.querySelectorAll(contrastSelectors.join(','))]
      .filter(
        (element) =>
          visible(element) && !element.matches(':disabled') && element.textContent?.trim(),
      )
      .map((element) => {
        const foreground = parseColor(getComputedStyle(element).color);
        const minimum = Math.min(
          ...backgrounds(element).map((background) => {
            const foregroundLuminance = luminance(composite(foreground, background));
            const backgroundLuminance = luminance(background);
            return (
              (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
              (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
            );
          }),
        );
        if (minimum < 4.5)
          violations.push({ kind: 'contrast', element: label(element), measured: minimum });
        return { element: label(element), ratio: minimum };
      });
    return { width, targets, surfaces, contrasts, violations };
  }, options);
}
