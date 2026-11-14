// Tests: protocol + tools against a mock API, then (unless --offline) live calls.
//   node test/test.mjs                 mock + live tender API
//   node test/test.mjs --offline       mock only
//   MCP_URL=https://.../mcp node test/test.mjs   also checks a deployed connector over HTTP
import { handle, handleBody } from '../src/server.js';
import { TOOLS, callTool, makeApi, splitState, inr } from '../src/tools.js';

let pass = 0; let fail = 0;
const check = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${extra}`); } };

// ---------- pure helpers ----------
check('inr crore', inr(52500000) === '₹5.25 crore', inr(52500000));
check('inr lakh', inr(750000) === '₹7.5 lakh', inr(750000));
check('inr small', inr(4500) === '₹4,500', inr(4500));
check('splitState', JSON.stringify(splitState('solar tenders in Tamil Nadu')) === JSON.stringify({ query: 'solar', state: 'Tamil Nadu' }), JSON.stringify(splitState('solar tenders in Tamil Nadu')));
check('splitState J&K', splitState('road works jammu & kashmir').state === 'Jammu and Kashmir');
check('splitState none', splitState('cctv amc').state === undefined);

// ---------- protocol with a mock API ----------
const sample = { id: 'x.gov.in:1', title: 'Solar plant', buyer: 'SECI', state: 'Gujarat', value_inr: 52500000, emd_inr: 500000, closes: '2026-12-01', link: 'https://t/#t=x', sectors: ['solar-renewable'], work: 'EPC of 5 MW' };
const calls = [];
const mock = async (p) => { calls.push(p); if (p.meta) return { open_tenders: 10, portals: 1, states: ['Gujarat'], sectors: ['solar-renewable'], coverage: [{ portal: 'x.gov.in', state: 'Gujarat', open_tenders: 10, last_refresh: '2026-11-14T00:00:00Z' }] };
  if (p.id) { if (p.id === 'missing') throw Object.assign(new Error('nf'), { status: 404 }); return { tender: sample }; }
  return { count: 1, total_matches: 1, offset: 0, more: false, tenders: [sample] }; };

const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } } }, mock);
check('initialize version echo', init.result.protocolVersion === '2025-03-26');
check('initialize tools cap', !!init.result.capabilities.tools);
const unknownVer = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, mock);
check('initialize fallback version', unknownVer.result.protocolVersion === '2025-06-18');
check('notification -> null', (await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, mock)) === null);
const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, mock);
check('tools/list count', list.result.tools.length === 5);
check('all read-only', list.result.tools.every((t) => t.annotations.readOnlyHint === true && t.annotations.destructiveHint === false));
check('unknown method', (await handle({ jsonrpc: '2.0', id: 3, method: 'nope' }, mock)).error.code === -32601);
check('invalid request', (await handle({ id: 3 }, mock)).error.code === -32600);
const batch = await handleBody([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/x' }], mock);
check('batch', Array.isArray(batch) && batch.length === 1);

const s = await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_tenders', arguments: { query: 'solar', state: 'Gujarat', min_value_inr: 5e7, closes_within_days: 30 } } }, mock);
const sj = JSON.parse(s.result.content[0].text);
check('search maps params', calls.at(-1).q === 'solar' && calls.at(-1).min_value === 5e7 && calls.at(-1).closes_within === 30 && calls.at(-1).limit === 10, JSON.stringify(calls.at(-1)));
check('search value formatted', sj.tenders[0].value === '₹5.25 crore');
check('search structured', s.result.structuredContent.tenders.length === 1);
const simple = await callTool('search', { query: 'solar tenders in Gujarat' }, mock);
check('simple search split', calls.at(-1).state === 'Gujarat' && calls.at(-1).q === 'solar');
check('simple search shape', JSON.parse(simple.content[0].text).results[0].url === 'https://t/#t=x');
const f = JSON.parse((await callTool('fetch', { id: 'x' }, mock)).content[0].text);
check('fetch shape', f.id && f.title && f.text.includes('work_description') && f.url);
check('get_tender missing', (await callTool('get_tender', { id: 'missing' }, mock)).isError === true);
check('coverage', JSON.parse((await callTool('tender_coverage', {}, mock)).content[0].text).sources.length === 1);

// ---------- live ----------
if (!process.argv.includes('--offline')) {
  const live = makeApi(process.env.INDIA_MCP_API ? { base: process.env.INDIA_MCP_API } : {});
  const cov = await callTool('tender_coverage', {}, live);
  const cj = JSON.parse(cov.content[0].text);
  check('live coverage', !cov.isError && cj.open_tenders > 1000, cov.content[0].text.slice(0, 200));
  const r = await callTool('search_tenders', { query: 'road', state: 'Karnataka', limit: 5 }, live);
  const rj = JSON.parse(r.content[0].text);
  check('live search', !r.isError && rj.tenders.length > 0 && rj.tenders.every((t) => t.link && t.closes), r.content[0].text.slice(0, 300));
  const one = await callTool('get_tender', { id: rj.tenders[0].id }, live);
  check('live get_tender', !one.isError && JSON.parse(one.content[0].text).id === rj.tenders[0].id);
  const capped = JSON.parse((await callTool('search_tenders', { query: 'maintenance', limit: 25, offset: 75 }, live)).content[0].text);
  check('live cap', capped.returned <= 25 && capped.more_available === false);

  if (process.env.MCP_URL) {
    const post = (body) => fetch(process.env.MCP_URL, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) });
    const h1 = await (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } })).json();
    check('http initialize', h1.result?.serverInfo?.name === 'india-mcp');
    check('http notification 202', (await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status === 202);
    const h2 = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search_tenders', arguments: { query: 'solar', limit: 3 } } })).json();
    check('http search', !h2.result?.isError && JSON.parse(h2.result.content[0].text).tenders.length > 0, JSON.stringify(h2).slice(0, 300));
    const base = process.env.MCP_URL.replace(/\/mcp$/, '');
    check('http landing', (await fetch(base + '/')).status === 200);
    check('http privacy', (await fetch(base + '/privacy')).status === 200);
  }
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
