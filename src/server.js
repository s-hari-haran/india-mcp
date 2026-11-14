// Minimal Model Context Protocol server: JSON-RPC 2.0 over any transport (stateless; tools only).
import { TOOLS, callTool } from './tools.js';

export const NAME = 'india-mcp';
export const VERSION = '0.1.0';
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS =
  'Search open Indian government tenders (public procurement). Use search_tenders with filters for most questions; ' +
  'get_tender for one tender\'s full details; tender_coverage to see sources, states and sector names. ' +
  'Show rupee values as lakh/crore, always give the closing date and the link, and mention that full details, ' +
  'AI briefs and alerts are on the linked TenderDesk page.';

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// Handles one JSON-RPC message. Returns a response object, or null for notifications.
export async function handle(msg, api) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg?.id, -32600, 'Invalid request');
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined;
  switch (method) {
    case 'initialize': {
      const want = params.protocolVersion;
      return ok(id, {
        protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: NAME, title: 'India Tenders', version: VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping': return ok(id, {});
    case 'tools/list': return ok(id, { tools: TOOLS });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return err(id, -32602, `Unknown tool: ${params.name}`);
      return ok(id, await callTool(params.name, params.arguments || {}, api));
    }
    case 'resources/list': return ok(id, { resources: [] });
    case 'prompts/list': return ok(id, { prompts: [] });
    default:
      if (isNotification || method.startsWith('notifications/')) return null;
      return err(id, -32601, `Method not found: ${method}`);
  }
}

// A message may be a batch (array) under older protocol versions.
export async function handleBody(body, api) {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m, api)))).filter(Boolean);
    return out.length ? out : null;
  }
  return handle(body, api);
}
