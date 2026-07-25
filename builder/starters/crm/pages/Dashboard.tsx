import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.tsx'
import StatRow from '../components/StatRow.tsx'
import ChartPanel from '../components/ChartPanel.tsx'
import FunnelChart from '../components/FunnelChart.tsx'
import TopList from '../components/TopList.tsx'
import ActivityFeed from '../components/ActivityFeed.tsx'
import Button from '../components/Button.tsx'
import Alert from '../components/Alert.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { BarChart } from '../components/Chart.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { STAGES, money, shortMoney, weightedValue, winRate } from '../lib/pipeline.ts'
import { Target, Wallet, Trophy, Users } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const { data: deals, loading: dealsLoading, error } = useResource('deals')
  const { data: leads, loading: leadsLoading } = useResource('leads')
  const loading = dealsLoading || leadsLoading

  const stats = useMemo(() => {
    const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
    const won = deals.filter((d) => d.stage === 'won')
    return {
      open: open.length,
      openValue: open.reduce((n, d) => n + (Number(d.value) || 0), 0),
      weighted: weightedValue(deals),
      wonValue: won.reduce((n, d) => n + (Number(d.value) || 0), 0),
      rate: winRate(deals),
      newLeads: leads.filter((l) => l.status === 'new').length,
    }
  }, [deals, leads])

  // The funnel is the pipeline's own shape: how many deals sit at each stage, then how many actually closed.
  const funnel = useMemo(() => ([
    ...STAGES.map((s) => ({ label: s.title, value: deals.filter((d) => d.stage === s.id).length })),
    { label: 'Won', value: deals.filter((d) => d.stage === 'won').length, hint: 'Closed this period' },
  ]), [deals])

  const bySource = useMemo(() => {
    const counts = new Map()
    for (const l of leads) counts.set(l.source || 'other', (counts.get(l.source || 'other') || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
  }, [leads])

  const byStage = useMemo(
    () => STAGES.map((s) => ({ label: s.title, value: deals.filter((d) => d.stage === s.id).reduce((n, d) => n + (Number(d.value) || 0), 0) })),
    [deals]
  )

  const recent = useMemo(
    () => [...deals]
      .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
      .slice(0, 6)
      .map((d) => ({ actor: d.company || 'Deal', action: `moved to ${d.stage}`, target: d.title, time: String(d.updated_at || d.created_at || '').slice(0, 10) })),
    [deals]
  )

  return (
    <DashboardShell
      title="Dashboard"
      description={user ? 'Your pipeline, and anyone reporting to you.' : 'Sign in to see your numbers.'}
      actions={<div className="flex gap-2"><Button as={Link} to="/leads" variant="secondary">Leads</Button><Button as={Link} to="/deals">Pipeline</Button></div>}
    >
      {error ? <Alert tone="danger" className="mb-6">{error.message}</Alert> : null}

      <StatRow
        columns={4}
        stats={[
          { label: 'Open deals', value: loading ? '—' : stats.open, icon: <Target size={16} />, hint: shortMoney(stats.openValue) + ' at face value' },
          { label: 'Weighted pipeline', value: loading ? '—' : shortMoney(stats.weighted), icon: <Wallet size={16} />, hint: 'By each deal’s own probability' },
          { label: 'Closed won', value: loading ? '—' : shortMoney(stats.wonValue), icon: <Trophy size={16} />, hint: stats.rate == null ? 'No closed deals yet' : `${stats.rate}% win rate` },
          { label: 'New leads', value: loading ? '—' : stats.newLeads, icon: <Users size={16} />, hint: 'Not yet contacted' },
        ]}
      />

      {loading ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-xl2" />
          <Skeleton className="h-72 w-full rounded-xl2" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Value by stage" value={shortMoney(stats.openValue)} subtitle="Open deals only">
              <BarChart items={byStage} />
            </ChartPanel>
            <FunnelChart title="Pipeline funnel" steps={funnel} valueLabel="deals" showDropOff />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <TopList
              title="Leads by source"
              items={bySource}
              valueLabel="leads"
              total={leads.length}
              showShare
              emptyText="No leads yet — add the first one from the Leads page."
            />
            <ActivityFeed items={recent} />
          </div>
        </>
      )}

      {!loading && !deals.length ? (
        <Alert tone="info" className="mt-6" action={<Button as={Link} to="/deals" size="sm">Add a deal</Button>}>
          Nothing in the pipeline yet. These figures fill in as soon as there is something to measure —
          the weighted total is {money(0)} until then.
        </Alert>
      ) : null}
    </DashboardShell>
  )
}
