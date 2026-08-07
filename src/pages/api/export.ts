import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db/client';
import { getUserTransactions } from '../../lib/services/transactions';

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = locals.runtime.env;
  const db = getDb(env.DB);
  const format = url.searchParams.get('format') ?? 'csv';

  try {
    const { transactions } = await getUserTransactions(db, env.ENCRYPTION_KEY, user.id, {
      limit: 100000,
    });

    if (format === 'json') {
      return new Response(JSON.stringify(transactions, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="ledgr-export-${Date.now()}.json"`,
        },
      });
    }

    // CSV export
    const headers = ['Date', 'Time', 'Type', 'Product', 'Category', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance'];
    const rows = transactions.map(t => [
      t.startedDate.toISOString().slice(0, 10),
      t.startedDate.toISOString().slice(11, 16),
      t.type,
      t.product,
      t.category,
      escapeCSV(t.description),
      t.amount.toFixed(2),
      t.fee.toFixed(2),
      t.currency,
      t.state,
      t.balance?.toFixed(2) ?? '',
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="ledgr-export-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}
