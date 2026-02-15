import type { APIRoute } from 'astro';
import { json, getAuthUser, getEnv, getDb } from '../../lib/api-helpers';
import { eq } from 'drizzle-orm';
import * as schema from '../../lib/schema';
import type { Transaction, AIInsight } from '../../lib/process-csv';

async function generateAIInsights(
  txns: Transaction[],
  apiKey: string,
): Promise<AIInsight[]> {
  const active = txns.filter((t) => t.state !== 'REVERTED' && t.product === 'Current');

  let totalIncome = 0;
  let totalSpending = 0;
  const catSpend: Record<string, number> = {};
  const merchantSpend: Record<string, { total: number; count: number }> = {};
  const monthlySpend: Record<string, number> = {};
  const monthlyIncome: Record<string, number> = {};

  for (const t of active) {
    const m = t.startedDate.slice(0, 7);
    if (
      t.amount > 0 &&
      (t.type === 'Topup' || (t.type === 'Transfer' && t.description.startsWith('Payment from')))
    ) {
      totalIncome += t.amount;
      monthlyIncome[m] = (monthlyIncome[m] || 0) + t.amount;
    }
    if (
      t.amount < 0 &&
      !t.description.toLowerCase().includes('depositing savings') &&
      !t.description.toLowerCase().includes('to pocket')
    ) {
      const abs = Math.abs(t.amount);
      totalSpending += abs;
      catSpend[t.category] = (catSpend[t.category] || 0) + abs;
      monthlySpend[m] = (monthlySpend[m] || 0) + abs;
      if (t.type === 'Card Payment') {
        if (!merchantSpend[t.description]) merchantSpend[t.description] = { total: 0, count: 0 };
        merchantSpend[t.description].total += abs;
        merchantSpend[t.description].count++;
      }
    }
  }

  const topCats = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topMerchants = Object.entries(merchantSpend).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  const months = Object.keys(monthlySpend).sort();
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome * 100).toFixed(1) : '0';

  const summaryText = `
Financial Summary (GBP):
- Total Income: \u00a3${totalIncome.toFixed(0)}
- Total Spending: \u00a3${totalSpending.toFixed(0)}
- Savings Rate: ${savingsRate}%
- Period: ${months[0] || 'N/A'} to ${months[months.length - 1] || 'N/A'}
- Transaction Count: ${active.length}

Top Spending Categories:
${topCats.map(([cat, total]) => `  ${cat}: \u00a3${total.toFixed(0)}`).join('\n')}

Top Merchants:
${topMerchants.map(([name, d]) => `  ${name}: \u00a3${d.total.toFixed(0)} (${d.count}x)`).join('\n')}

Monthly Spending Trend:
${months.map((m) => `  ${m}: spent \u00a3${(monthlySpend[m] || 0).toFixed(0)}, earned \u00a3${(monthlyIncome[m] || 0).toFixed(0)}`).join('\n')}
`.trim();

  try {
    const response = await fetch('https://api.kilo.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          {
            role: 'system',
            content: `You are a personal finance analyst. Given a user's transaction summary, produce exactly 8-10 actionable insights. Each insight must be a JSON object with:
- "type": one of "warning", "success", "tip", "info"
- "title": short headline (max 8 words)
- "description": 2-3 sentences of specific, personalised advice referencing their actual numbers
- "metric": a key number/percentage badge (e.g. "\u00a3150/mo", "23%", "\u00a35,400 target")

Focus on: spending alerts, savings tips, wealth-building suggestions, budget optimisation, and positive reinforcement.
Respond ONLY with a JSON array, no markdown, no explanation.`,
          },
          { role: 'user', content: summaryText },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('Kilo API error:', response.status, await response.text());
      return [];
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices?.[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const insights: AIInsight[] = JSON.parse(cleaned);
    return insights.filter((i) => i.type && i.title && i.description);
  } catch (err) {
    console.error('AI insights generation failed:', err);
    return [];
  }
}

export const POST: APIRoute = async (context) => {
  const session = await getAuthUser(context);
  if (!session?.user) return json({ error: 'Unauthorized' }, 401);

  const env = getEnv(context);
  const db = getDb(env);
  const userId = session.user.id;

  try {
    const rows = await db
      .select()
      .from(schema.transaction)
      .where(eq(schema.transaction.userId, userId));

    if (rows.length === 0) {
      return json({ insights: [] });
    }

    const txns: Transaction[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      product: r.product,
      startedDate: r.startedDate,
      completedDate: r.completedDate,
      description: r.description,
      amount: r.amount,
      fee: r.fee,
      currency: r.currency,
      state: r.state,
      balance: r.balance,
      category: r.category,
      fingerprint: r.fingerprint,
    }));

    const insights = await generateAIInsights(txns, env.KILO_API_KEY);

    // Cache insights
    const dataHash = String(rows.length) + '-' + (rows[rows.length - 1]?.fingerprint || '');
    await db.delete(schema.insightCache).where(eq(schema.insightCache.userId, userId));
    if (insights.length > 0) {
      await db.insert(schema.insightCache).values({
        id: crypto.randomUUID(),
        userId,
        insights: JSON.stringify(insights),
        generatedAt: new Date(),
        dataHash,
      });
    }

    return json({ insights });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, 500);
  }
};
