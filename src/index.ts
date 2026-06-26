interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * OpenFEC MCP — Federal Election Commission campaign finance data
 *
 * BYO key: requires a free API key from https://api.open.fec.gov/developers/
 * Passed via _apiKey parameter. Rate limit: 1,000 requests/hour.
 *
 * Tools:
 * - search_candidates: search federal election candidates
 * - candidate_financials: get financial summary for a candidate
 * - search_committees: search political committees (PACs, party committees, etc.)
 * - committee_financials: get financial summary for a committee/PAC
 * - search_contributions: itemized individual contributions ("follow the money")
 */


const BASE = 'https://api.open.fec.gov/v1';

// ── Helpers ───────────────────────────────────────────────────────────

function extractKey(args: Record<string, unknown>): string {
  const key = args._apiKey as string;
  delete args._apiKey;
  if (!key) throw new Error('OpenFEC API key required. Get one free at https://api.open.fec.gov/developers/ and pass via _apiKey.');
  return key;
}

async function fecGet(apiKey: string, path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenFEC API error (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────

type FECCandidate = {
  candidate_id?: string | null;
  name?: string | null;
  party_full?: string | null;
  party?: string | null;
  state?: string | null;
  district?: string | null;
  office_full?: string | null;
  office?: string | null;
  incumbent_challenge_full?: string | null;
  candidate_status?: string | null;
  election_years?: number[] | null;
  cycles?: number[] | null;
  has_raised_funds?: boolean | null;
  federal_funds_flag?: boolean | null;
};

type FECFinancials = {
  candidate_id?: string | null;
  candidate_name?: string | null;
  cycle?: number | null;
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;
  total_receipts?: number | null;
  total_disbursements?: number | null;
  cash_on_hand_end_period?: number | null;
  debts_owed_by_committee?: number | null;
  total_individual_contributions?: number | null;
  total_contributions?: number | null;
  other_political_committee_contributions?: number | null;
  candidate_contribution?: number | null;
  total_loans?: number | null;
  operating_expenditures?: number | null;
};

type FECCommittee = {
  committee_id?: string | null;
  name?: string | null;
  committee_type_full?: string | null;
  committee_type?: string | null;
  designation_full?: string | null;
  party_full?: string | null;
  state?: string | null;
  treasurer_name?: string | null;
  organization_type_full?: string | null;
  filing_frequency?: string | null;
  cycles?: number[] | null;
  candidate_ids?: string[] | null;
  sponsor_candidate_ids?: string[] | null;
};

type FECResponse<T> = {
  pagination?: { count?: number; pages?: number; per_page?: number; page?: number };
  results: T[];
};

function formatCandidate(c: FECCandidate) {
  return {
    candidate_id: c.candidate_id ?? null,
    name: c.name ?? null,
    party: c.party_full ?? c.party ?? null,
    state: c.state ?? null,
    district: c.district ?? null,
    office: c.office_full ?? c.office ?? null,
    incumbent_challenge: c.incumbent_challenge_full ?? null,
    status: c.candidate_status ?? null,
    election_years: c.election_years ?? [],
    has_raised_funds: c.has_raised_funds ?? null,
  };
}

function formatFinancials(f: FECFinancials) {
  return {
    candidate_id: f.candidate_id ?? null,
    candidate_name: f.candidate_name ?? null,
    cycle: f.cycle ?? null,
    coverage_start: f.coverage_start_date ?? null,
    coverage_end: f.coverage_end_date ?? null,
    total_receipts: f.total_receipts ?? null,
    total_disbursements: f.total_disbursements ?? null,
    cash_on_hand: f.cash_on_hand_end_period ?? null,
    debts_owed: f.debts_owed_by_committee ?? null,
    individual_contributions: f.total_individual_contributions ?? null,
    total_contributions: f.total_contributions ?? null,
    pac_contributions: f.other_political_committee_contributions ?? null,
    candidate_contribution: f.candidate_contribution ?? null,
    total_loans: f.total_loans ?? null,
    operating_expenditures: f.operating_expenditures ?? null,
  };
}

function formatCommittee(c: FECCommittee) {
  return {
    committee_id: c.committee_id ?? null,
    name: c.name ?? null,
    type: c.committee_type_full ?? c.committee_type ?? null,
    designation: c.designation_full ?? null,
    party: c.party_full ?? null,
    state: c.state ?? null,
    treasurer: c.treasurer_name ?? null,
    organization_type: c.organization_type_full ?? null,
    filing_frequency: c.filing_frequency ?? null,
    cycles: c.cycles ?? [],
    candidate_ids: c.candidate_ids ?? [],
  };
}

// ── Tool definitions ──────────────────────────────────────────────────

const tools: McpToolExport['tools'] = [
  {
    name: 'search_candidates',
    description:
      'Search federal election candidates by name, state, or party. Returns candidate ID, name, party, office, state, district, and election years. Example: search_candidates("Biden", state="DE", party="DEM")',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'OpenFEC API key' },
        query: { type: 'string', description: 'Candidate name to search (e.g., "Sanders")' },
        state: { type: 'string', description: 'Two-letter state code (e.g., "CA", "NY")' },
        party: { type: 'string', description: 'Party code: "DEM", "REP", "LIB", "GRE", etc.' },
      },
      required: ['_apiKey', 'query'],
    },
  },
  {
    name: 'candidate_financials',
    description:
      'Get campaign finance summary for a candidate by their FEC candidate ID (e.g., "P80001571"). Returns total receipts, disbursements, cash on hand, individual contributions, PAC contributions, and loans. Use search_candidates first to find the candidate ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'OpenFEC API key' },
        candidate_id: { type: 'string', description: 'FEC candidate ID (e.g., "P80001571")' },
        cycle: { type: 'number', description: 'Election cycle year (e.g., 2024). Defaults to most recent.' },
      },
      required: ['_apiKey', 'candidate_id'],
    },
  },
  {
    name: 'search_committees',
    description:
      'Search political committees (PACs, Super PACs, party committees) by name. Returns committee ID, name, type, designation, party, treasurer, and associated candidates. Example: search_committees("ActBlue")',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'OpenFEC API key' },
        query: { type: 'string', description: 'Committee name to search (e.g., "Americans for Prosperity")' },
      },
      required: ['_apiKey', 'query'],
    },
  },
  {
    name: 'committee_financials',
    description:
      'Get campaign-finance totals for a committee / PAC by its FEC committee ID (e.g., "C00401224"). Returns receipts, disbursements, cash on hand, and independent expenditures by cycle. Use search_committees first to find the committee ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'OpenFEC API key' },
        committee_id: { type: 'string', description: 'FEC committee ID (e.g., "C00401224")' },
        cycle: { type: 'number', description: 'Election cycle year (e.g., 2024). Defaults to most recent.' },
      },
      required: ['_apiKey', 'committee_id'],
    },
  },
  {
    name: 'search_contributions',
    description:
      'Search itemized individual contributions ("follow the money") — who donated, how much, employer/occupation, city/state, and date. Filter by recipient committee, donor name, employer, state, minimum amount, and cycle. PREFER for "who donated to <committee>", "<person>\'s political donations", "donations from <employer> employees". Requires at least one of committee_id or contributor_name.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'OpenFEC API key' },
        committee_id: { type: 'string', description: 'Recipient committee ID (from search_committees).' },
        contributor_name: { type: 'string', description: 'Donor name to search (e.g. "Musk").' },
        contributor_employer: { type: 'string', description: 'Donor employer filter (e.g. "Google").' },
        state: { type: 'string', description: 'Two-letter donor state (e.g. "CA").' },
        min_amount: { type: 'number', description: 'Minimum contribution amount in USD.' },
        cycle: { type: 'number', description: 'Two-year transaction period / cycle (even year, e.g. 2024).' },
      },
      required: ['_apiKey'],
    },
  },
];

// ── callTool dispatcher ───────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const key = extractKey(args);

  switch (name) {
    case 'search_candidates':
      return searchCandidates(key, args);
    case 'candidate_financials':
      return candidateFinancials(key, args);
    case 'search_committees':
      return searchCommittees(key, args.query as string);
    case 'committee_financials':
      return committeeFinancials(key, args);
    case 'search_contributions':
      return searchContributions(key, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Tool implementations ─────────────────────────────────────────────

async function searchCandidates(apiKey: string, args: Record<string, unknown>) {
  const params: Record<string, string> = {
    q: args.query as string,
    per_page: '20',
    sort: '-election_years',
  };
  if (args.state) params.state = args.state as string;
  if (args.party) params.party = args.party as string;

  const data = (await fecGet(apiKey, '/candidates/search/', params)) as FECResponse<FECCandidate>;

  return {
    total: data.pagination?.count ?? data.results.length,
    returned: data.results.length,
    candidates: data.results.map(formatCandidate),
  };
}

async function candidateFinancials(apiKey: string, args: Record<string, unknown>) {
  const candidateId = args.candidate_id as string;
  const params: Record<string, string> = {
    per_page: '5',
    sort: '-cycle',
  };
  if (args.cycle) params.cycle = String(args.cycle);

  const data = (await fecGet(apiKey, `/candidate/${candidateId}/totals/`, params)) as FECResponse<FECFinancials>;

  if (data.results.length === 0) {
    throw new Error(`No financial data found for candidate ${candidateId}`);
  }

  return {
    candidate_id: candidateId,
    cycles: data.results.map(formatFinancials),
  };
}

async function searchCommittees(apiKey: string, query: string) {
  const params: Record<string, string> = {
    q: query,
    per_page: '20',
  };

  const data = (await fecGet(apiKey, '/committees/', params)) as FECResponse<FECCommittee>;

  return {
    query,
    total: data.pagination?.count ?? data.results.length,
    returned: data.results.length,
    committees: data.results.map(formatCommittee),
  };
}

type FECCommitteeTotals = {
  cycle?: number | null;
  receipts?: number | null;
  disbursements?: number | null;
  last_cash_on_hand_end_period?: number | null;
  independent_expenditures?: number | null;
  contributions?: number | null;
  contribution_refunds?: number | null;
};

async function committeeFinancials(apiKey: string, args: Record<string, unknown>) {
  const committeeId = String(args.committee_id ?? '').trim();
  if (!committeeId) throw new Error('committee_id is required (use search_committees to find it).');
  const params: Record<string, string> = { per_page: '5', sort: '-cycle' };
  if (args.cycle) params.cycle = String(args.cycle);

  const data = (await fecGet(apiKey, `/committee/${encodeURIComponent(committeeId)}/totals/`, params)) as FECResponse<FECCommitteeTotals>;
  if (data.results.length === 0) {
    throw new Error(`No financial data found for committee ${committeeId}`);
  }
  return {
    committee_id: committeeId,
    cycles: data.results.map((r) => ({
      cycle: r.cycle ?? null,
      receipts: r.receipts ?? null,
      disbursements: r.disbursements ?? null,
      cash_on_hand: r.last_cash_on_hand_end_period ?? null,
      contributions: r.contributions ?? null,
      independent_expenditures: r.independent_expenditures ?? null,
    })),
  };
}

type FECContribution = {
  contributor_name?: string | null;
  contribution_receipt_amount?: number | null;
  contribution_receipt_date?: string | null;
  contributor_employer?: string | null;
  contributor_occupation?: string | null;
  contributor_city?: string | null;
  contributor_state?: string | null;
  committee_name?: string | null;
  committee?: { name?: string | null } | null;
};

async function searchContributions(apiKey: string, args: Record<string, unknown>) {
  const committeeId = String(args.committee_id ?? '').trim();
  const contributorName = String(args.contributor_name ?? '').trim();
  if (!committeeId && !contributorName) {
    throw new Error('Provide at least one of "committee_id" or "contributor_name".');
  }
  const params: Record<string, string> = { per_page: '20', sort: '-contribution_receipt_amount' };
  if (committeeId) params.committee_id = committeeId;
  if (contributorName) params.contributor_name = contributorName;
  if (args.contributor_employer) params.contributor_employer = String(args.contributor_employer);
  if (args.state) params.contributor_state = String(args.state).toUpperCase();
  if (args.min_amount) params.min_amount = String(args.min_amount);
  if (args.cycle) params.two_year_transaction_period = String(args.cycle);

  const data = (await fecGet(apiKey, '/schedules/schedule_a/', params)) as FECResponse<FECContribution>;
  return {
    total: data.pagination?.count ?? data.results.length,
    returned: data.results.length,
    contributions: data.results.map((c) => ({
      contributor: c.contributor_name ?? null,
      amount: c.contribution_receipt_amount ?? null,
      date: c.contribution_receipt_date ?? null,
      employer: c.contributor_employer ?? null,
      occupation: c.contributor_occupation ?? null,
      city: c.contributor_city ?? null,
      state: c.contributor_state ?? null,
      recipient: c.committee_name ?? c.committee?.name ?? null,
    })),
  };
}

export default { tools, callTool, meter: { credits: 5 } } satisfies McpToolExport;
