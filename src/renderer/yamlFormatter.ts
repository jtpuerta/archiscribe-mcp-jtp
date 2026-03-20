import { ViewObject, ElementObject, ModelData } from '../model/types';
import { ResponseFormatter } from './types';
import {
  buildViewListData,
  buildViewDetailsData,
  buildElementListData,
  buildElementDetailsData,
  withDisclaimerField
} from './dataBuilders';

// --- YAML Serializer ---

function needsQuoting(s: string): boolean {
  return s === '' ||
    /^[\s]/.test(s) || /[\s]$/.test(s) ||
    /[:#{}[\],&*?|>!%@`]/.test(s) ||
    /^(true|false|null|yes|no|on|off)$/i.test(s) ||
    /^[\d.eE+-]+$/.test(s);
}

function scalarToYaml(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const s = String(value);
  if (needsQuoting(s)) return JSON.stringify(s);
  return s;
}

export function toYaml(data: unknown, indent: number = 0): string {
  const pad = '  '.repeat(indent);

  if (data === null || data === undefined) return 'null';
  if (typeof data !== 'object') {
    const s = String(data);
    if (s.includes('\n')) {
      return '|-\n' + s.split('\n').map(l => pad + '  ' + l).join('\n');
    }
    return scalarToYaml(data);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return '[]';
    const items: string[] = [];
    for (const item of data) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const inner = objectToYamlLines(item as Record<string, unknown>, indent + 1);
        items.push(`${pad}- ${inner[0].trimStart()}`);
        for (let i = 1; i < inner.length; i++) {
          items.push(inner[i]);
        }
      } else {
        items.push(`${pad}- ${toYaml(item, indent + 1)}`);
      }
    }
    return items.join('\n');
  }

  return objectToYamlLines(data as Record<string, unknown>, indent).join('\n');
}

function objectToYamlLines(obj: Record<string, unknown>, indent: number): string[] {
  const pad = '  '.repeat(indent);
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return [`${pad}{}`];

  const lines: string[] = [];
  for (const [key, value] of entries) {
    if (value === null) {
      lines.push(`${pad}${key}: null`);
    } else if (typeof value === 'object') {
      const isEmpty = Array.isArray(value)
        ? value.length === 0
        : Object.entries(value as object).filter(([, v]) => v !== undefined).length === 0;
      if (isEmpty) {
        lines.push(`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`);
      } else {
        lines.push(`${pad}${key}:`);
        lines.push(toYaml(value, indent + 1));
      }
    } else if (typeof value === 'string' && value.includes('\n')) {
      lines.push(`${pad}${key}: ${toYaml(value, indent)}`);
    } else {
      lines.push(`${pad}${key}: ${scalarToYaml(value)}`);
    }
  }
  return lines;
}

export class YamlFormatter implements ResponseFormatter {
  readonly contentType = 'text/yaml';

  formatViewList(views: ViewObject[], disclaimer?: string): string {
    return toYaml(withDisclaimerField(buildViewListData(views), disclaimer));
  }

  formatViewDetails(model: ModelData, view: ViewObject, disclaimer?: string): string {
    return toYaml(withDisclaimerField(buildViewDetailsData(model, view), disclaimer));
  }

  formatElementList(elements: ElementObject[], disclaimer?: string): string {
    return toYaml(withDisclaimerField(buildElementListData(elements), disclaimer));
  }

  formatElementDetails(model: ModelData, element: ElementObject, disclaimer?: string): string {
    return toYaml(withDisclaimerField(buildElementDetailsData(model, element), disclaimer));
  }
}
