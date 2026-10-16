import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Users,
  CalendarCheck,
  UserCheck,
  Target,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  UserX,
  PhoneCall,
  Sparkles,
  BarChart3,
  Layers,
  Compass,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import pb from '@/lib/pocketbase/client'

export type Group = {
  key: string
  label: string
  kind: string
  form_id?: string
  form_name?: string
  form_version?: string
  validity?: string
  valid_from?: string
  valid_to?: string
  submissions: number
  human_handoffs: number
  completed_appointments: number
  numerator: number
  denominator: number
  rate: number | null
  coverage: number | null
}

export type Baseline = {
  version: number
  period: { from: string; to: string }
  numerator: number
  denominator: number
  rate: number | null
  coverage: number | null
  sufficiency_coverage: number | null
  sufficient_submissions: number
  sufficiency_threshold: number
  calculation_status: string
  sufficiency_status: string
  period_timezone: string
  total_submissions: number
  formula: string
  frozen_at: string
  frozen_by: string
  reason?: string
  criterion: string
}

export type DistributionItem = {
  name: string
  count: number
}

export type TimelineDay = {
  date: string
  submissions: number
  handoffs: number
  appointments: number
}

export type AttendantMetric = {
  attendant_id: string
  name: string
  role: string
  total_received: number
  in_progress: number
  appointments_concluded: number
  closed_without_appointment: number
  pending: number
  conversion_rate: number | null
  kanban: {
    recebidos: number
    em_contato: number
    agendados: number
    encerrados: number
  }
}

export type ComparisonsSummary = {
  period: { from: string; to: string }
  previous_period: { from: string; to: string }
  total_submissions: {
    current: number
    previous: number
    change_pct: number
  }
  completed_appointments: {
    current: number
    previous: number
    change_pct: number
  }
  human_handoffs: {
    current: number
    previous: number
    change_pct: number
  }
  rate: {
    current: number | null
    previous: number | null
    change_points: number | null
  }
  coverage: {
    current: number | null
    previous: number | null
    change_points: number | null
  }
}

export type DashboardResult = {
  available: boolean
  preview?: boolean
  message?: string
  partial?: boolean
  period?: { from: string; to: string }
  metric?: {
    name: string
    numerator: number
    denominator: number
    rate: number | null
    formula: string
  }
  coverage?: {
    total_submissions: number
    attribution_received: number
    attribution_incomplete: number
    attribution_absent: number
    attribution_unknown: number
    complete_rate: number | null
    sufficiency: {
      sufficient_submissions: number
      complete_rate: number | null
      threshold: number
      status: string
    }
    version_validity: Record<string, number>
  }
  comparisons?: {
    by_form_version: Group[]
    by_source: Group[]
    by_medium: Group[]
    by_campaign: Group[]
  }
  comparisons_summary?: ComparisonsSummary
  timeline?: TimelineDay[]
  distributions?: {
    objetivo: DistributionItem[]
    proximidade: DistributionItem[]
    ocupacao: DistributionItem[]
    interesse_em_visita: DistributionItem[]
  }
  attendants?: AttendantMetric[]
  baselines?: Baseline[]
  baseline_created?: Baseline | null
  baseline_available?: boolean
  sources?: Record<string, string>
  read_errors?: string[]
  decisions?: {
    b3_04_confirmed: boolean
    b3_05_confirmed: boolean
    read_roles: string[]
    marketing_aggregates_only: boolean
    b3_05_criterion?: string
    baseline_period?: string
    note?: string
  }
}

const defaultPeriod = () => {
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 29)
  const format = (value: Date) => value.toISOString().slice(0, 10)
  return { from: format(from), to: format(to) }
}

const formatCount = (value?: number | null) =>
  value === undefined || value === null ? '—' : value.toLocaleString('pt-BR')

const formatRate = (value?: number | null) =>
  value === undefined || value === null ? '—' : `${(value * 100).toFixed(1)}%`

const formatPoints = (value?: number | null) =>
  value === undefined || value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)} p.p.`

const formatChangePct = (value?: number | null) => {
  if (value === undefined || value === null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

const formatDateTime = (value: string) =>
  value ? new Date(value.replace(' ', 'T')).toLocaleString('pt-BR') : '—'

const formatDateOnly = (value: string) => {
  if (!value) return ''
  const parts = value.slice(0, 10).split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`
  return value
}

const statusFor = (err: unknown) => (err as { status?: number })?.status || 0

// Paleta de cores para gráficos harmonizada com Terrazzo R1
const CHART_COLORS = [
  '#ea580c', // orange-600
  '#f97316', // orange-500
  '#fb923c', // orange-400
  '#fdba74', // orange-300
  '#0284c7', // sky-600
  '#0d9488', // teal-600
  '#e11d48', // rose-600
  '#8b5cf6', // purple-500
  '#64748b', // slate-500
]

export const Dashboard = () => {
  const initial = defaultPeriod()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [error, setError] = useState('')
  const [data, setData] = useState<DashboardResult | null>(null)
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [freezeBusy, setFreezeBusy] = useState(false)
  const [selectedAttendantFilter, setSelectedAttendantFilter] = useState<string>('todos')

  const authenticated = pb.authStore.isValid
  const role = String(pb.authStore.record?.role || '')
  const canRead = ['champion', 'gestao', 'supervisora', 'subgerente'].includes(role)
  const canFreeze = role === 'champion'

  const load = async (fromDate = from, toDate = to) => {
    if (!pb.authStore.isValid) return
    setLoading(true)
    setError('')
    try {
      const result = await pb.send<DashboardResult>('/backend/v1/dashboard', {
        method: 'POST',
        body: JSON.stringify({ action: 'read', from: fromDate, to: toDate }),
        headers: { 'Content-Type': 'application/json' },
      })
      setData(result)
    } catch (err) {
      console.error(err)
      if (statusFor(err) === 401) {
        pb.authStore.clear()
        setData(null)
        setError('Sua sessão expirou. Entre novamente.')
      } else if (statusFor(err) === 403) {
        setData(null)
        setError('Seu papel não está autorizado pela matriz de acesso do dashboard.')
      } else {
        setError('Não foi possível carregar o dashboard neste momento.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      if (!pb.authStore.isValid) return
      try {
        await pb.collection('users').authRefresh()
        const bootstrapRole = String(pb.authStore.record?.role || '')
        if (!['champion', 'gestao', 'supervisora', 'subgerente'].includes(bootstrapRole)) {
          pb.authStore.clear()
          setData(null)
          setLoginError('Este papel não está autorizado a consultar o dashboard agregado.')
          return
        }
        await load()
      } catch (err) {
        console.error(err)
        pb.authStore.clear()
        setLoginError('Sua sessão anterior não é mais válida. Entre novamente.')
      }
    }
    bootstrap()
  }, [])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginBusy(true)
    setLoginError('')
    try {
      await pb.collection('users').authWithPassword(email, password)
      if (
        !['champion', 'gestao', 'supervisora', 'subgerente'].includes(
          String(pb.authStore.record?.role || ''),
        )
      ) {
        pb.authStore.clear()
        setLoginError('Este papel não está autorizado a consultar o dashboard agregado.')
        return
      }
      await load()
    } catch (err) {
      console.error(err)
      setLoginError(
        'Não foi possível autenticar. Verifique a conta e a senha; o sistema não distingue conta inexistente de senha incorreta.',
      )
    } finally {
      setLoginBusy(false)
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setData(null)
    setError('')
  }

  const freeze = async () => {
    if (!canFreeze) {
      setError('Somente o Champion pode congelar o baseline.')
      return
    }
    if (!reason.trim()) {
      setError('Informe o motivo do congelamento.')
      return
    }
    setFreezeBusy(true)
    setError('')
    try {
      const result = await pb.send<DashboardResult>('/backend/v1/dashboard', {
        method: 'POST',
        body: JSON.stringify({ action: 'freeze', from, to, reason: reason.trim() }),
        headers: { 'Content-Type': 'application/json' },
      })
      setReason('')
      setData(result)
      if (result.period) {
        setFrom(result.period.from)
        setTo(result.period.to)
      }
    } catch (err) {
      console.error(err)
      if (statusFor(err) === 403) setError('Apenas Champion pode congelar o baseline.')
      else if (statusFor(err) === 409)
        setError('Congelamento não realizado: verifique as fontes e os dados agregados do período.')
      else setError('Não foi possível congelar o baseline.')
    } finally {
      setFreezeBusy(false)
    }
  }

  const runQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void load()
  }

  const setPeriodPreset = (days: number) => {
    const toDate = new Date()
    const fromDate = new Date(toDate)
    fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1))
    const toIso = toDate.toISOString().slice(0, 10)
    const fromIso = fromDate.toISOString().slice(0, 10)
    setFrom(fromIso)
    setTo(toIso)
    void load(fromIso, toIso)
  }

  // Filtragem de atendentes no Kanban
  const filteredAttendants = useMemo(() => {
    if (!data?.attendants) return []
    if (selectedAttendantFilter === 'todos') return data.attendants
    return data.attendants.filter((a) => a.attendant_id === selectedAttendantFilter)
  }, [data?.attendants, selectedAttendantFilter])

  // Dados para gráficos de pizza/barras de origens
  const sourcesChartData = useMemo(() => {
    if (!data?.comparisons?.by_source) return []
    return data.comparisons.by_source
      .map((g) => ({
        name: g.label,
        submissions: g.submissions,
        appointments: g.completed_appointments,
      }))
      .slice(0, 8)
  }, [data?.comparisons?.by_source])

  const campaignsChartData = useMemo(() => {
    if (!data?.comparisons?.by_campaign) return []
    return data.comparisons.by_campaign
      .map((g) => ({
        name: g.label,
        submissions: g.submissions,
        handoffs: g.human_handoffs,
        appointments: g.completed_appointments,
      }))
      .slice(0, 8)
  }, [data?.comparisons?.by_campaign])

  const timelineChartData = useMemo(() => {
    if (!data?.timeline) return []
    return data.timeline.map((t) => ({
      date: formatDateOnly(t.date),
      fullDate: t.date,
      Submissões: t.submissions,
      Encaminhamentos: t.handoffs,
      Agendamentos: t.appointments,
    }))
  }, [data?.timeline])

  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-8 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Cabeçalho */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-orange-100 pb-6 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline dark:text-orange-400"
              >
                ← Início
              </Link>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <Link
                to="/visao"
                className="text-sm font-medium text-slate-600 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400"
              >
                Visão Geral
              </Link>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <Link
                to="/saude"
                className="text-sm font-medium text-slate-600 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400"
              >
                Saúde da Integração
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                <Sparkles className="h-3 w-3" /> Terrazzo R1 Sports Club
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Fase 3 & 4 · Agregados
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Dashboard Interativo & Kanbans de Atendimento
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Métricas em tempo real, séries temporais, distribuições de perfil, comparativo com
              período anterior e acompanhamento agregado por atendente.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {authenticated && (
              <div className="flex items-center gap-3">
                <div className="text-right text-xs">
                  <p className="font-semibold">{pb.authStore.record?.email}</p>
                  <span className="inline-block rounded-md bg-orange-100 px-2 py-0.5 font-bold uppercase text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                    {role}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
          >
            {error}
          </div>
        )}

        {!authenticated ? (
          <div className="mx-auto max-w-md py-8">
            <form
              onSubmit={login}
              className="rounded-3xl border border-orange-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-black">Acesso ao Dashboard</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Acesso restrito à gestão e supervisão com matriz autorizada.
                </p>
              </div>

              <label className="block text-sm font-semibold">
                E-mail profissional
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ex: gerencia@r1sportsclub.com.br"
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm transition-colors focus:border-orange-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:focus:border-orange-500"
                />
              </label>

              <label className="mt-4 block text-sm font-semibold">
                Senha de acesso
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm transition-colors focus:border-orange-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:focus:border-orange-500"
                />
              </label>

              {loginError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-300"
                >
                  {loginError}
                </p>
              )}

              <button
                disabled={loginBusy}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-orange-600 px-4 font-bold text-white shadow-sm transition-all hover:bg-orange-700 disabled:opacity-50"
              >
                {loginBusy ? 'Entrando...' : 'Entrar no Dashboard'}
              </button>
            </form>
          </div>
        ) : !canRead ? (
          <section
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <p className="font-bold">Acesso não autorizado</p>
            <p className="mt-1 text-sm">
              Seu papel ({role}) não está habilitado na política de leitura do dashboard
              (lead_dashboard_policy).
            </p>
          </section>
        ) : (
          <>
            {/* Controles de Filtro e Período */}
            <div className="mb-8 rounded-3xl border border-orange-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <form onSubmit={runQuery} className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Data Inicial
                    </label>
                    <input
                      aria-label="Data inicial"
                      required
                      type="date"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                      className="mt-1 block min-h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Data Final
                    </label>
                    <input
                      aria-label="Data final"
                      required
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      className="mt-1 block min-h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <button
                    disabled={loading}
                    className="min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-700 disabled:opacity-50"
                  >
                    {loading ? 'Atualizando...' : 'Aplicar Período'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Atalhos:
                  </span>
                  <button
                    type="button"
                    onClick={() => setPeriodPreset(7)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-orange-500 hover:text-orange-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Últimos 7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodPreset(15)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-orange-500 hover:text-orange-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Últimos 15 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodPreset(30)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-orange-500 hover:text-orange-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Últimos 30 dias (Padrão)
                  </button>
                </div>
              </form>

              {data?.comparisons_summary && (
                <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5 text-orange-600" />
                    Janela consultada: {data.period?.from} até {data.period?.to}
                  </span>
                  <span className="text-slate-400">
                    Janela anterior de comparação: {data.comparisons_summary.previous_period.from}{' '}
                    até {data.comparisons_summary.previous_period.to}
                  </span>
                </div>
              )}
            </div>

            {data && !data.available && (
              <div
                role="status"
                className="mb-8 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200"
              >
                {data.message || 'O dashboard está temporariamente indisponível.'}
              </div>
            )}

            {data?.partial && (
              <div
                role="status"
                className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <span className="font-bold">Atenção: Leitura parcial de dados.</span> A taxa não é
                exibida como completa por indisponibilidade de fonte:{' '}
                {data.read_errors?.join(', ') || 'indisponíveis'}. Nenhum zero foi fabricado.
              </div>
            )}

            {/* PARTE 1: GRÁFICOS GERAIS & CARDS COMPARATIVOS (NO TOPO) */}
            <div className="space-y-8">
              {/* Cards de KPI com comparativo vs Período Anterior */}
              <section aria-label="Indicadores principais">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Indicadores Principais</h2>
                    <p className="text-xs text-slate-500">
                      Comparações dinâmicas em relação à janela anterior de mesma duração
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {/* Total de Leads / Submissões */}
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition-all hover:border-orange-200 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Total de Leads
                      </span>
                      <div className="rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
                        <Users className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-black">
                      {formatCount(
                        data?.comparisons_summary?.total_submissions.current ??
                          data?.coverage?.total_submissions,
                      )}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      {data?.comparisons_summary ? (
                        <>
                          {data.comparisons_summary.total_submissions.change_pct >= 0 ? (
                            <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400">
                              <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                              {formatChangePct(
                                data.comparisons_summary.total_submissions.change_pct,
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center font-bold text-rose-600 dark:text-rose-400">
                              <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
                              {formatChangePct(
                                data.comparisons_summary.total_submissions.change_pct,
                              )}
                            </span>
                          )}
                          <span className="text-slate-400">
                            vs. anterior (
                            {formatCount(data.comparisons_summary.total_submissions.previous)})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">submissões do formulário</span>
                      )}
                    </div>
                  </article>

                  {/* Encaminhamentos Humanos */}
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition-all hover:border-orange-200 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Encaminhamentos
                      </span>
                      <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                        <UserCheck className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-black">
                      {formatCount(data?.metric?.denominator)}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      {data?.comparisons_summary ? (
                        <>
                          {data.comparisons_summary.human_handoffs.change_pct >= 0 ? (
                            <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400">
                              <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                              {formatChangePct(data.comparisons_summary.human_handoffs.change_pct)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center font-bold text-rose-600 dark:text-rose-400">
                              <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
                              {formatChangePct(data.comparisons_summary.human_handoffs.change_pct)}
                            </span>
                          )}
                          <span className="text-slate-400">
                            vs. anterior (
                            {formatCount(data.comparisons_summary.human_handoffs.previous)})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">casos na fila de atendimento</span>
                      )}
                    </div>
                  </article>

                  {/* Agendamentos Concluídos */}
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition-all hover:border-orange-200 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Agendamentos
                      </span>
                      <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                        <CalendarCheck className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-black">
                      {formatCount(data?.metric?.numerator)}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      {data?.comparisons_summary ? (
                        <>
                          {data.comparisons_summary.completed_appointments.change_pct >= 0 ? (
                            <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400">
                              <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                              {formatChangePct(
                                data.comparisons_summary.completed_appointments.change_pct,
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center font-bold text-rose-600 dark:text-rose-400">
                              <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
                              {formatChangePct(
                                data.comparisons_summary.completed_appointments.change_pct,
                              )}
                            </span>
                          )}
                          <span className="text-slate-400">
                            vs. anterior (
                            {formatCount(data.comparisons_summary.completed_appointments.previous)})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">visitas presenciais e aulas</span>
                      )}
                    </div>
                  </article>

                  {/* Conversão Geral (Métrica Norte) */}
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition-all hover:border-orange-200 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Taxa de Conversão
                      </span>
                      <div className="rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
                        <Target className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-black">{formatRate(data?.metric?.rate)}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      {data?.comparisons_summary?.rate.change_points !== null &&
                      data?.comparisons_summary?.rate.change_points !== undefined ? (
                        <>
                          {data.comparisons_summary.rate.change_points >= 0 ? (
                            <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400">
                              <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                              {formatPoints(data.comparisons_summary.rate.change_points)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center font-bold text-rose-600 dark:text-rose-400">
                              <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
                              {formatPoints(data.comparisons_summary.rate.change_points)}
                            </span>
                          )}
                          <span className="text-slate-400">
                            anterior {formatRate(data.comparisons_summary.rate.previous)}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">agendamentos ÷ encaminhamentos</span>
                      )}
                    </div>
                  </article>

                  {/* Cobertura de Atribuição */}
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition-all hover:border-orange-200 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Cobertura Atribuição
                      </span>
                      <div className="rounded-xl bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                        <Compass className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-black">
                      {formatRate(data?.coverage?.complete_rate)}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500">
                        {formatCount(data?.coverage?.attribution_received)} de{' '}
                        {formatCount(data?.coverage?.total_submissions)} leads com tag
                      </span>
                    </div>
                  </article>
                </div>
              </section>

              {/* Gráficos Interativos Principais (Série Temporal + Origens) */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Evolução Temporal de Leads (Área) - 2 Colunas */}
                <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                        Série Temporal
                      </p>
                      <h3 className="text-lg font-black">
                        Evolução de Leads e Atendimentos por Dia
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full bg-orange-500"></span> Submissões
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full bg-sky-500"></span> Encaminhamentos
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full bg-emerald-500"></span> Agendamentos
                      </span>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    {timelineChartData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        Nenhum dado temporal no período selecionado
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={timelineChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ea580c" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#ea580c" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorHandoff" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorAppt" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e2e8f0"
                            opacity={0.5}
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '12px',
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Submissões"
                            stroke="#ea580c"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorSub)"
                          />
                          <Area
                            type="monotone"
                            dataKey="Encaminhamentos"
                            stroke="#0284c7"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorHandoff)"
                          />
                          <Area
                            type="monotone"
                            dataKey="Agendamentos"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorAppt)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>

                {/* Origens dos Leads (utm_source) - 1 Coluna */}
                <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Canais de Captação
                    </p>
                    <h3 className="text-lg font-black">Origem dos Leads (utm_source)</h3>
                  </div>

                  <div className="h-72 w-full">
                    {sourcesChartData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        Nenhuma origem identificada
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={sourcesChartData}
                          layout="vertical"
                          margin={{ top: 5, right: 15, left: 15, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={false}
                            stroke="#e2e8f0"
                            opacity={0.5}
                          />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            width={90}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '12px',
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                          />
                          <Bar
                            dataKey="submissions"
                            name="Submissões"
                            fill="#ea580c"
                            radius={[0, 6, 6, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>
              </div>

              {/* Análises do Formulário de Captação (Objetivo, Proximidade, Rotina/Ocupação) */}
              <div className="grid gap-6 md:grid-cols-3">
                {/* Distribuição por Objetivo */}
                <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Formulário
                    </p>
                    <h3 className="text-base font-black">Distribuição por Objetivo</h3>
                    <p className="text-xs text-slate-500">
                      Respostas dos leads no questionário inicial
                    </p>
                  </div>

                  <div className="h-60 w-full">
                    {!data?.distributions?.objetivo?.length ? (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        Sem respostas registradas
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.distributions.objetivo}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={75}
                            innerRadius={45}
                            paddingAngle={3}
                          >
                            {data.distributions.objetivo.map((_, index) => (
                              <Cell
                                key={`cell-obj-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: '12px',
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              fontSize: '11px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                    {data?.distributions?.objetivo?.map((item, idx) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-slate-600 dark:text-slate-300"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          ></span>
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Distribuição por Proximidade */}
                <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Geolocalização
                    </p>
                    <h3 className="text-base font-black">Proximidade (Alto do Itaigara)</h3>
                    <p className="text-xs text-slate-500">
                      Critério de elegibilidade territorial da unidade
                    </p>
                  </div>

                  <div className="h-60 w-full">
                    {!data?.distributions?.proximidade?.length ? (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        Sem respostas registradas
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.distributions.proximidade}
                          layout="vertical"
                          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={false}
                            stroke="#e2e8f0"
                            opacity={0.5}
                          />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#64748b' }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            width={90}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '12px',
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              fontSize: '11px',
                            }}
                          />
                          <Bar dataKey="count" name="Leads" fill="#0284c7" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                    {data?.distributions?.proximidade?.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-slate-600 dark:text-slate-300"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Distribuição por Rotina / Ocupação */}
                <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Perfil
                    </p>
                    <h3 className="text-base font-black">Rotina & Ocupação</h3>
                    <p className="text-xs text-slate-500">
                      Segmento de rotina declarado no formulário
                    </p>
                  </div>

                  <div className="h-60 w-full">
                    {!data?.distributions?.ocupacao?.length ? (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        Sem respostas registradas
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.distributions.ocupacao}
                          layout="vertical"
                          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={false}
                            stroke="#e2e8f0"
                            opacity={0.5}
                          />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#64748b' }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            width={90}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '12px',
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              fontSize: '11px',
                            }}
                          />
                          <Bar dataKey="count" name="Leads" fill="#0d9488" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                    {data?.distributions?.ocupacao?.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-slate-600 dark:text-slate-300"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Conversão por Campanha (Barras) */}
              {campaignsChartData.length > 0 && (
                <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Performance de Marketing
                    </p>
                    <h3 className="text-lg font-black">Conversão por Campanha (utm_campaign)</h3>
                    <p className="text-xs text-slate-500">
                      Volume de submissões vs. agendamentos concluídos gerados por cada campanha
                    </p>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={campaignsChartData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            backgroundColor: '#0f172a',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar
                          dataKey="submissions"
                          name="Submissões"
                          fill="#f97316"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="appointments"
                          name="Agendamentos Concluídos"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </div>

            {/* PARTE 2: KANBANS COM DADOS INDIVIDUAIS POR ATENDENTE (LOGO ABAIXO) */}
            <div className="mt-12 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-orange-100 pt-8 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-orange-100 p-1.5 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                      <Layers className="h-4 w-4" />
                    </span>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Pipelines Individuais Agregados
                    </p>
                  </div>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Quadro Kanban de Atendimento por Consultor
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Visualização das etapas do pipeline para cada atendente. Nenhum dado ou contato
                    de lead individual é exibido — volumetrias agregadas e taxas por atendente.
                  </p>
                </div>

                {/* Filtro interativo de Atendente */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <label
                    htmlFor="attendant-filter"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400"
                  >
                    Filtrar Atendente:
                  </label>
                  <select
                    id="attendant-filter"
                    value={selectedAttendantFilter}
                    onChange={(e) => setSelectedAttendantFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm transition-colors focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="todos">
                      Todos os Atendentes ({data?.attendants?.length || 0})
                    </option>
                    {data?.attendants?.map((att) => (
                      <option key={att.attendant_id} value={att.attendant_id}>
                        {att.name} ({att.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comparativo Resumido entre Atendentes */}
              {data?.attendants && data.attendants.length > 0 && (
                <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Comparativo Consolidado de Atendentes no Período
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                          <th className="py-2.5 font-semibold">Atendente</th>
                          <th className="py-2.5 font-semibold">Papel</th>
                          <th className="py-2.5 text-right font-semibold">Total Atribuído</th>
                          <th className="py-2.5 text-right font-semibold">Em Contato</th>
                          <th className="py-2.5 text-right font-semibold">Agendados</th>
                          <th className="py-2.5 text-right font-semibold">Encerrados s/ Agend.</th>
                          <th className="py-2.5 text-right font-semibold">Taxa de Conversão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.attendants.map((att) => (
                          <tr
                            key={att.attendant_id}
                            className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-800/50 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-2.5 font-bold text-slate-900 dark:text-slate-100">
                              {att.name}
                            </td>
                            <td className="py-2.5">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {att.role}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-semibold">
                              {att.total_received}
                            </td>
                            <td className="py-2.5 text-right text-blue-600 dark:text-blue-400">
                              {att.in_progress}
                            </td>
                            <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {att.appointments_concluded}
                            </td>
                            <td className="py-2.5 text-right text-slate-500">
                              {att.closed_without_appointment}
                            </td>
                            <td className="py-2.5 text-right font-black text-orange-600 dark:text-orange-400">
                              {formatRate(att.conversion_rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Quadros Kanban Individuais por Atendente */}
              {filteredAttendants.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-orange-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
                  Nenhum atendente com dados no período selecionado.
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredAttendants.map((att) => (
                    <article
                      key={att.attendant_id}
                      className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      {/* Cabeçalho do Atendente */}
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 font-black text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                            {att.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-black">{att.name}</h3>
                              <span className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold uppercase text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                {att.role}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Total de casos na responsabilidade: {att.total_received} · Taxa de
                              conversão individual: {formatRate(att.conversion_rate)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Ativos na fila:{' '}
                            <strong className="text-slate-900 dark:text-slate-100">
                              {att.in_progress + att.pending}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* As 4 Colunas do Kanban para este atendente */}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Coluna 1: Recebidos / Na Fila */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              Recebidos
                            </span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {att.kanban.recebidos}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Leads pendentes de início de contato
                          </p>

                          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
                              {att.kanban.recebidos}
                            </p>
                            <span className="text-[11px] text-slate-500">casos aguardando</span>
                          </div>
                        </div>

                        {/* Coluna 2: Em Contato / Assumidos */}
                        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                              <PhoneCall className="h-3.5 w-3.5 text-blue-500" />
                              Em Contato
                            </span>
                            <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs font-black text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {att.kanban.em_contato}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-blue-600/70 dark:text-blue-400/70">
                            Casos assumidos em negociação ativa
                          </p>

                          <div className="mt-4 rounded-xl border border-blue-100 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
                              {att.kanban.em_contato}
                            </p>
                            <span className="text-[11px] text-slate-500">
                              atendimentos em curso
                            </span>
                          </div>
                        </div>

                        {/* Coluna 3: Agendados / Concluídos */}
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              Agendados
                            </span>
                            <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-black text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                              {att.kanban.agendados}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-emerald-600/70 dark:text-emerald-400/70">
                            Visitas e aulas experimentais marcadas
                          </p>

                          <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                              {att.kanban.agendados}
                            </p>
                            <span className="text-[11px] text-slate-500">sucesso / conversões</span>
                          </div>
                        </div>

                        {/* Coluna 4: Encerrados sem agendamento */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                              <UserX className="h-3.5 w-3.5 text-slate-400" />
                              Encerrados
                            </span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {att.kanban.encerrados}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Casos finalizados sem visita
                          </p>

                          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-2xl font-black text-slate-600 dark:text-slate-400">
                              {att.kanban.encerrados}
                            </p>
                            <span className="text-[11px] text-slate-500">sem conversão</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* SEÇÃO AUDITÁVEL & BASELINE CONGELADO (APPEND-ONLY) */}
            <section className="mt-12 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">
                    Baseline Versionado · Append-Only
                  </p>
                  <h2 className="mt-1 text-2xl font-black">Histórico de Versões Congeladas</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Critério B3-05 registrado: mês civil completo anterior em America/Bahia.
                  </p>
                </div>
              </div>

              {data?.baselines?.length ? (
                <ol className="mt-6 space-y-3">
                  {data.baselines.map((baseline) => (
                    <li
                      key={baseline.version}
                      className="rounded-2xl border border-slate-200 p-4 transition-colors dark:border-slate-700"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-bold">Baseline v{baseline.version}</h3>
                        <span className="text-xs font-semibold">
                          {baseline.calculation_status === 'NAO_CALCULAVEL'
                            ? 'Não calculável'
                            : 'Calculável'}{' '}
                          ·{' '}
                          {baseline.sufficiency_status === 'INSUFICIENTE'
                            ? 'Suficiência insuficiente'
                            : baseline.sufficiency_status === 'NAO_CALCULAVEL'
                              ? 'Suficiência não calculável'
                              : 'Suficiência suficiente'}
                        </span>
                        <time className="text-xs text-slate-500">
                          {formatDateTime(baseline.frozen_at)}
                        </time>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                        Período: {baseline.period.from} a {baseline.period.to} · numerador{' '}
                        {formatCount(baseline.numerator)} ÷ denominador{' '}
                        {formatCount(baseline.denominator)} · taxa {formatRate(baseline.rate)} ·
                        cobertura {formatRate(baseline.coverage)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {baseline.formula} · congelado por {baseline.frozen_by} · suficiência{' '}
                        {formatRate(baseline.sufficiency_coverage)} (
                        {formatCount(baseline.sufficient_submissions)}/
                        {formatCount(baseline.total_submissions)}, limiar{' '}
                        {formatRate(baseline.sufficiency_threshold)}, {baseline.period_timezone})
                        {baseline.reason ? ` · motivo: ${baseline.reason}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-xs text-slate-500">
                  Nenhuma versão congelada até o momento.
                </p>
              )}

              {canFreeze &&
                data?.decisions?.b3_04_confirmed &&
                data?.decisions?.b3_05_confirmed &&
                !data?.preview &&
                data?.baseline_available !== false && (
                  <div className="mt-6 rounded-2xl bg-orange-50 p-5 dark:bg-orange-950/30">
                    <h4 className="font-bold text-orange-950 dark:text-orange-200">
                      Congelar Próxima Versão · Somente Champion
                    </h4>
                    <p className="mt-1 text-xs text-orange-900/80 dark:text-orange-300/80">
                      Congela o mês civil completo anterior em America/Bahia. Fontes com erro
                      bloqueiam o congelamento.
                    </p>
                    <label className="mt-4 block text-xs font-semibold">
                      Motivo do congelamento
                      <textarea
                        required
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Descreva a razão da fixação do baseline para auditoria..."
                        className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <button
                      disabled={freezeBusy || data?.partial}
                      onClick={() => void freeze()}
                      className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-orange-600 px-4 text-xs font-bold text-white transition-all hover:bg-orange-700 disabled:opacity-50"
                    >
                      {freezeBusy ? 'Congelando...' : 'Congelar Baseline Oficial'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default Dashboard
