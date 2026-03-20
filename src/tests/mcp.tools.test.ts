import { describe, it, expect } from 'vitest';
import { createTools } from '../../src/mcp/tools';
import { join } from 'path';

describe('MCP tools', () => {
  it('searchViewsHandler returns markdown', async () => {
    const modelPath = join(__dirname, '..', '..', 'data', 'archimate-scribe-demo-model.xml');
    const tools = createTools(modelPath);
    const result = await tools.searchViewsHandler({ query: 'dataflow' });
    expect(result.content).toContain('Dataflow');
    expect(result.content).toContain('Views');
  });

  it('getViewDetailsHandler returns view markdown', async () => {
    const modelPath = join(__dirname, '..', '..', 'data', 'archimate-scribe-demo-model.xml');
    const tools = createTools(modelPath);
    const result = await tools.getViewDetailsHandler({ viewname: 'Dataflow View' });
    expect(result.content).toContain('ArchiMate View name: Dataflow View');
    expect(result.content).toContain('Elements');
    expect(result.id).toBeTypeOf('string');
    expect(result.id && result.id.length).toBeGreaterThan(0);
  });

  it('searchElementsHandler returns markdown', async () => {
    const modelPath = join(__dirname, '..', '..', 'data', 'archimate-scribe-demo-model.xml');
    const tools = createTools(modelPath);
    
    // Test searching by name
    const nameResult = await tools.searchElementsHandler({ query: 'core' });
    expect(nameResult.content).toContain('Elements');
    expect(nameResult.content).toContain('Core');
    
    // Test searching by type
    const typeResult = await tools.searchElementsHandler({ type: 'ApplicationComponent' });
    expect(typeResult.content).toContain('ApplicationComponent');
  });

  it('getElementDetailsHandler returns element markdown', async () => {
    const modelPath = join(__dirname, '..', '..', 'data', 'archimate-scribe-demo-model.xml');
    const tools = createTools(modelPath);
    
    const result = await tools.getElementDetailsHandler({ elementname: 'RDBMS' });
    expect(result.content).toContain('ArchiMate Element:');
    expect(result.content).toContain('RDBMS');
    expect(result.id).toBeTypeOf('string');
    expect(result.id && result.id.length).toBeGreaterThan(0);
  });
});
