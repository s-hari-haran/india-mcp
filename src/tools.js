// The india-mcp tools. Pure functions over fetch, shared by the hosted connector (Cloudflare Worker) and the
// local stdio server (npx india-mcp). Data: free open-tender listings from TenderDesk.

export const DEFAULT_API = 'https://tenderdesk-020.pages.dev/api/open-tenders';
export const WEBSITE = 'https://tenderdesk-020.pages.dev';
export const BULK = 'https://apify.com/ironlabs/gepnic-tenders';

export const SECTORS = [
  'agriculture-food', 'chemicals-industrial-supplies', 'computers-cctv', 'consultancy', 'defence-security-equipment',
  'electrical-power', 'furniture-supplies', 'lab-scientific-equipment', 'machinery-spare-parts', 'manpower-security',
  'medical-health', 'mining-minerals', 'printing-signage', 'railways-metro', 'real-estate-ppp', 'roads-buildings',
  'software-it', 'solar-renewable', 'vehicles-transport', 'waste-management', 'water-sewage',
];

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export const TOOLS = [
  {
    name: 'search_tenders',
    title: 'Search Indian government tenders',
    description:
      'Search open public-procurement tenders in India (about 50,000 open at any time) from central and state ' +
      'e-procurement portals (CPPP, GeM, defence, 27+ states), PSUs and large companies, refreshed daily. ' +
      'Filter by words, state, kind of work, buyer, value in rupees and closing date. Returns up to 25 tenders per ' +
      'call (first 100 matches per search) with title, buyer, state, value, EMD, closing date and a link to full details. ' +
      'Values are in Indian rupees (1 lakh = 100,000; 1 crore = 10,000,000).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words describing the work or item, e.g. "solar power plant", "CCTV AMC", "road construction". Synonyms and abbreviations (AMC, O&M, CCTV) are understood.' },
        state: { type: 'string', description: 'Indian state or union territory, e.g. "Karnataka", "Tamil Nadu". Includes central tenders located there.' },
        sector: { type: 'string', enum: SECTORS, description: 'Kind of work.' },
        buyer: { type: 'string', description: 'Part of the buying organisation name, e.g. "NHAI", "Railway", "NTPC".' },
        min_value_inr: { type: 'number', description: 'Minimum estimated value in rupees (5 crore = 50000000).' },
        max_value_inr: { type: 'number', description: 'Maximum estimated value in rupees.' },
        closes_within_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Only tenders whose bids close within this many days.' },
        published_within_days: { type: 'integer', minimum: 0, maximum: 60, description: 'Only tenders first seen in the last N days (new tenders).' },
        sort: { type: 'string', enum: ['closing', 'value', 'newest'], description: 'closing = soonest deadline first (default), value = biggest first, newest = recently published first.' },
        limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Results to return (default 10, max 25).' },
        offset: { type: 'integer', minimum: 0, maximum: 75, description: 'Skip this many results (for the next page; max 75).' },
      },
      additionalProperties: false,
    },
    annotations: { title: 'Search Indian government tenders', ...READ_ONLY },
  },
  {
    name: 'get_tender',
    title: 'Get one tender',
    description: 'Full listing details of one open tender by its id (from search_tenders): buyer, department, location, value, EMD, fee, dates, kind of work, work description, reference number and links.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Tender id from search results.' } }, required: ['id'], additionalProperties: false },
    annotations: { title: 'Get one tender', ...READ_ONLY },
  },
  {
    name: 'tender_coverage',
    title: 'Tender sources and coverage',
    description: 'Which portals and states are covered, how many tenders are open in each, when each was last refreshed, and the list of kinds of work (sectors) usable in search_tenders.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Tender sources and coverage', ...READ_ONLY },
  },
  // ChatGPT deep research / company knowledge expect exactly these two tools.
  {
    name: 'search',
    title: 'Search tenders (simple)',
    description: 'Simple full-text search over open Indian government tenders. Returns ids, titles and links; use fetch for details. Prefer search_tenders when filters (state, value, deadline) are needed.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'What to look for, e.g. "solar tenders in Gujarat".' } }, required: ['query'], additionalProperties: false },
    annotations: { title: 'Search tenders (simple)', ...READ_ONLY },
  },
  {
    name: 'fetch',
    title: 'Fetch tender',
    description: 'Fetch the full listing of one tender by the id returned from search.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Tender id.' } }, required: ['id'], additionalProperties: false },
    annotations: { title: 'Fetch tender', ...READ_ONLY },
  },
];

// ---------- helpers ----------
const STATES = ['Andaman and Nicobar', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli', 'Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

// "solar tenders in gujarat" -> { query: "solar", state: "Gujarat" } for the simple search tool.
export function splitState(text) {
  let q = String(text || '');
  let state;
  for (const s of STATES) {
    const re = new RegExp(`\\b(in\\s+)?${s.replace(/ and /, ' (and|&) ')}\\b`, 'i');
    if (re.test(q)) { state = s; q = q.replace(re, ' '); break; }
  }
  q = q.replace(/\b(tenders?|bids?|government|govt|open|latest|india|indian)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return { query: q, state };
}

export function inr(v) {
  if (v == null) return null;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, '')} crore`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.?0+$/, '')} lakh`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)));

function brief(t) {
  return compact({
    id: t.id, title: t.title, buyer: t.buyer, state: t.state, location: t.location,
    value: inr(t.value_inr), emd: inr(t.emd_inr), closes: t.closes, published: t.published,
    sectors: t.sectors, link: t.link,
  });
}

function full(t) {
  return compact({ ...brief(t), department: t.department, pincode: t.pincode, value_inr: t.value_inr, emd_inr: t.emd_inr,
    fee: inr(t.fee_inr), closes_at: t.closes_at, opens_at: t.opens_at, type: t.type, category: t.category,
    work_description: t.work, period_days: t.period_days, reference: t.reference, portal: t.portal, source_portal: t.source });
}

const text = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 1) }], structuredContent: obj });
const errorResult = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

// ---------- tool calls ----------
// api(params) -> parsed JSON from the open-tenders endpoint (throws Error with a user-readable message).
export function makeApi({ base = DEFAULT_API, headers = {}, fetchImpl = fetch } = {}) {
  return async (params) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)]));
    const r = await fetchImpl(`${base}?${qs}`, { headers: { accept: 'application/json', 'user-agent': 'india-mcp', ...headers } });
    let j;
    try { j = await r.json(); } catch { throw new Error('the tender service is unavailable right now; please try again in a few minutes'); }
    if (!r.ok) throw Object.assign(new Error(j.error || `Tender service returned ${r.status}`), { status: r.status });
    return j;
  };
}

export async function callTool(name, args = {}, api) {
  try {
    switch (name) {
      case 'search_tenders': {
        const j = await api({
          q: args.query, state: args.state, sector: args.sector, buyer: args.buyer,
          min_value: args.min_value_inr, max_value: args.max_value_inr, closes_within: args.closes_within_days,
          published_within: args.published_within_days, sort: args.sort, limit: args.limit ?? 10, offset: args.offset,
        });
        return text(compact({
          total_matches: j.total_matches, returned: j.count, offset: j.offset, more_available: j.more,
          tenders: j.tenders.map(brief),
          tip: j.count === 0 ? 'No open tenders matched. Try fewer or broader words, drop the state or value filter, or check tender_coverage.' : undefined,
          note: `Listings via TenderDesk (${WEBSITE}): open a link for AI briefs, alerts and bid tracking. Bulk data: ${BULK}`,
        }));
      }
      case 'get_tender':
      case 'fetch': {
        if (!args.id) return errorResult('id is required');
        const { tender } = await api({ id: args.id });
        if (name === 'get_tender') return text(full(tender));
        const f = full(tender);
        const body = Object.entries(f).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
        return text({ id: tender.id, title: tender.title, text: body, url: tender.link, metadata: { state: tender.state, closes: tender.closes, buyer: tender.buyer } });
      }
      case 'search': {
        const { query, state } = splitState(args.query);
        const j = await api({ q: query, state, limit: 25 });
        return text({ results: j.tenders.map((t) => ({ id: t.id, title: `${t.title} (${[t.buyer, t.state, t.closes && `closes ${t.closes}`].filter(Boolean).join(', ')})`, url: t.link })) });
      }
      case 'tender_coverage': {
        const j = await api({ meta: 1 });
        return text({ open_tenders: j.open_tenders, new_last_2_days: j.new_last_2_days, portals: j.portals, updated_at: j.updated_at,
          states: j.states, sectors: j.sectors,
          sources: j.coverage.slice(0, 120).map((c) => compact({ portal: c.portal, state: c.state, open: c.open_tenders, refreshed: c.last_refresh?.slice(0, 10) })) });
      }
      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return errorResult(e.status === 404 ? 'Tender not found (it may have closed).' : `Could not get tenders: ${e.message}`);
  }
}
