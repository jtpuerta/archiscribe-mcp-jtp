import { describe, it, expect } from 'vitest';
import { getFormatter, ResponseFormatter } from '../../src/renderer/formatters';
import { ModelLoader } from '../../src/model/loader';
import { join } from 'path';

const modelPath = join(__dirname, '..', '..', 'data', 'archimate-scribe-demo-model.xml');

function loadTestModel() {
  const loader = new ModelLoader(modelPath);
  return loader.load();
}

describe('getFormatter', () => {
  it('returns markdown formatter by default', () => {
    const f = getFormatter();
    expect(f.contentType).toBe('text/markdown');
  });

  it('returns json formatter', () => {
    const f = getFormatter('json');
    expect(f.contentType).toBe('application/json');
  });

  it('returns yaml formatter', () => {
    const f = getFormatter('yaml');
    expect(f.contentType).toBe('text/yaml');
  });

  it('falls back to markdown for unknown format', () => {
    const f = getFormatter('invalid' as any);
    expect(f.contentType).toBe('text/markdown');
  });
});

describe('MarkdownFormatter', () => {
  const formatter = getFormatter('markdown');
  const model = loadTestModel();

  it('formats view list as markdown', () => {
    const result = formatter.formatViewList(model.views);
    expect(result).toContain('# ArchiMate Views');
    expect(result).toContain('- ');
  });

  it('formats view details as markdown', () => {
    const view = model.views.find(v => v.name?.includes('Dataflow'));
    expect(view).toBeDefined();
    const result = formatter.formatViewDetails(model, view!);
    expect(result).toContain('# ArchiMate View name: Dataflow');
    expect(result).toContain('## Elements');
  });

  it('prepends disclaimer', () => {
    const result = formatter.formatViewList(model.views, 'DISCLAIMER: ');
    expect(result.startsWith('DISCLAIMER: ')).toBe(true);
  });
});

describe('JsonFormatter', () => {
  const formatter = getFormatter('json');
  const model = loadTestModel();

  it('formats view list as valid JSON', () => {
    const result = formatter.formatViewList(model.views);
    const parsed = JSON.parse(result);
    expect(parsed.views).toBeInstanceOf(Array);
    expect(parsed.views.length).toBeGreaterThan(0);
    expect(parsed.views[0]).toHaveProperty('name');
  });

  it('formats view details as valid JSON', () => {
    const view = model.views.find(v => v.name?.includes('Dataflow'));
    expect(view).toBeDefined();
    const result = formatter.formatViewDetails(model, view!);
    const parsed = JSON.parse(result);
    expect(parsed.name).toContain('Dataflow');
    expect(parsed.elements).toBeInstanceOf(Array);
    expect(parsed.relationships).toBeInstanceOf(Array);
  });

  it('formats element list as valid JSON', () => {
    const result = formatter.formatElementList(model.elements);
    const parsed = JSON.parse(result);
    expect(parsed.elements).toBeInstanceOf(Array);
    expect(parsed.elements[0]).toHaveProperty('name');
    expect(parsed.elements[0]).toHaveProperty('type');
  });

  it('formats element details as valid JSON', () => {
    const element = model.elements.find(e => e.name === 'RDBMS');
    expect(element).toBeDefined();
    const result = formatter.formatElementDetails(model, element!);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('RDBMS');
  });

  it('includes disclaimer as field', () => {
    const result = formatter.formatViewList(model.views, 'DISCLAIMER');
    const parsed = JSON.parse(result);
    expect(parsed.disclaimer).toBe('DISCLAIMER');
    expect(parsed.views).toBeInstanceOf(Array);
  });
});

describe('YamlFormatter', () => {
  const formatter = getFormatter('yaml');
  const model = loadTestModel();

  it('formats view list as YAML', () => {
    const result = formatter.formatViewList(model.views);
    expect(result).toContain('views:');
    expect(result).toContain('- name:');
  });

  it('formats view details as YAML', () => {
    const view = model.views.find(v => v.name?.includes('Dataflow'));
    expect(view).toBeDefined();
    const result = formatter.formatViewDetails(model, view!);
    expect(result).toContain('name: ');
    expect(result).toContain('elements:');
    expect(result).toContain('relationships:');
  });

  it('formats element list as YAML', () => {
    const result = formatter.formatElementList(model.elements);
    expect(result).toContain('elements:');
    expect(result).toContain('- name:');
  });

  it('formats element details as YAML', () => {
    const element = model.elements.find(e => e.name === 'RDBMS');
    expect(element).toBeDefined();
    const result = formatter.formatElementDetails(model, element!);
    expect(result).toContain('name: RDBMS');
  });

  it('indents nested properties correctly', () => {
    const view = model.views.find(v => v.name?.includes('Dataflow'));
    expect(view).toBeDefined();
    const result = formatter.formatViewDetails(model, view!);
    // properties: should be followed by indented children, not siblings
    expect(result).toMatch(/properties:\n\s{6,}Repository:/);
  });

  it('includes disclaimer as field', () => {
    const result = formatter.formatViewList(model.views, 'DISCLAIMER');
    expect(result).toMatch(/^disclaimer: DISCLAIMER/);
    expect(result).toContain('views:');
  });
});

describe('Format-aware tool handlers', () => {
  it('returns JSON when format=json', async () => {
    const { createTools } = await import('../../src/mcp/tools');
    const tools = createTools(modelPath);
    const result = await tools.searchViewsHandler({ query: 'dataflow', format: 'json' });
    const parsed = JSON.parse(result.content);
    expect(parsed.views).toBeInstanceOf(Array);
  });

  it('returns YAML when format=yaml', async () => {
    const { createTools } = await import('../../src/mcp/tools');
    const tools = createTools(modelPath);
    const result = await tools.searchViewsHandler({ query: 'dataflow', format: 'yaml' });
    expect(result.content).toContain('views:');
    expect(result.content).toContain('- name:');
  });
});
