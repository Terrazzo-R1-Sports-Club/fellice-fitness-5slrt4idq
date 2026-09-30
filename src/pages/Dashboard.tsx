import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'

type Group = {
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

type Baseline = {
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

type DashboardResult = {
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
  value === undefined || value === null
    ? 'Insuficiente para calcular'
    : `${(value * 100).toFixed(1)}%`
const formatDateTime = (value: string) =>
  value ? new Date(value.replace(' ', 'T')).toLocaleString('pt-BR') : '—'
const statusFor = (err: unknown) => (err as { status?: number })?.status || 0

const Section = ({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: Group[]
}) => (
  <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Comparativo</p>
      <h2 className="mt-2 text-xl font-black">{title}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </div>
    {rows.length === 0 ? (
      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Nenhum registro no período. Não há taxa calculável.
      </p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
              <th scope="col" className="py-3 pr-4">
                Grupo
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Submissões
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Encaminhamentos
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Agendamentos
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Taxa
              </th>
              <th scope="col" className="pl-3 py-3 text-right">
                Cobertura
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800"
              >
                <th scope="row" className="py-3 pr-4 font-semibold">
                  <span>{row.label}</span>
                  {row.validity && (
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Vigência: {row.valid_from || 'não verificada'}
                      {row.valid_to
                        ? ` a ${row.valid_to}`
                        : row.valid_from
                          ? ' até nova versão'
                          : ''}
                    </span>
                  )}
                </th>
                <td className="px-3 py-3 text-right">{formatCount(row.submissions)}</td>
                <td className="px-3 py-3 text-right">{formatCount(row.human_handoffs)}</td>
                <td className="px-3 py-3 text-right">{formatCount(row.completed_appointments)}</td>
                <td className="px-3 py-3 text-right">{formatRate(row.rate)}</td>
                <td className="pl-3 py-3 text-right">{formatRate(row.coverage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)

const Dashboard = () => {
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
  const authenticated = pb.authStore.isValid
  const role = String(pb.authStore.record?.role || '')
  const canRead = ['champion', 'gestao', 'supervisora', 'subgerente'].includes(role)
  const canFreeze = role === 'champion'

  const load = async () => {
    if (!pb.authStore.isValid) return
    setLoading(true)
    setError('')
    try {
      const result = await pb.send<DashboardResult>('/backend/v1/dashboard', {
        method: 'POST',
        body: JSON.stringify({ action: 'read', from, to }),
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

  return (
    <main className="min-h-screen bg-[#fffaf5] px-5 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold text-orange-600">
              ← Voltar ao formulário
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-orange-600">
              Fellice Fitness · Fase 3
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">
              Dashboard por formulário e campanha
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              Visão somente agregada, com fórmula, período, cobertura e vigência. Não exibe nomes,
              contatos nem registros individuais.
            </p>
          </div>
          {authenticated && (
            <button
              onClick={logout}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
            >
              Sair
            </button>
          )}
        </header>

        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
          >
            {error}
          </p>
        )}

        {!authenticated ? (
          <form
            onSubmit={login}
            className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-2xl font-bold">Acesso aos agregados</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              A leitura requer autenticação e papel autorizado.
            </p>
            <label className="mt-6 block text-sm font-semibold">
              E-mail
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Senha
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            {loginError && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300"
              >
                {loginError}
              </p>
            )}
            <button
              disabled={loginBusy}
              className="mt-5 min-h-12 w-full rounded-xl bg-orange-600 px-4 font-bold text-white disabled:opacity-50"
            >
              {loginBusy ? 'Entrando...' : 'Entrar no dashboard'}
            </button>
          </form>
        ) : !canRead ? (
          <section
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            Seu papel não está incluído na matriz de leitura do dashboard.
          </section>
        ) : (
          <>
            <form
              onSubmit={runQuery}
              className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-orange-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <label className="text-sm font-semibold">
                De
                <input
                  aria-label="Data inicial"
                  required
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="mt-2 block min-h-11 rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm font-semibold">
                Até
                <input
                  aria-label="Data final"
                  required
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="mt-2 block min-h-11 rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <button
                disabled={loading}
                className="min-h-11 rounded-xl bg-orange-600 px-5 font-bold text-white disabled:opacity-50"
              >
                {loading ? 'Carregando...' : 'Atualizar'}
              </button>
            </form>

            {data && !data.available && (
              <p
                role="status"
                className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200"
              >
                {data.message || 'O dashboard está indisponível.'}
              </p>
            )}

            {data?.available && (
              <>
                {data.partial && (
                  <p
                    role="status"
                    className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    Leitura parcial. A taxa não é exibida como completa. Fontes com falha:{' '}
                    {data.read_errors?.join(', ') || 'indisponíveis'}.
                  </p>
                )}
                {data.baseline_available === false && (
                  <p
                    role="status"
                    className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    Histórico de baseline indisponível; não é possível confirmar nem criar uma nova
                    versão agora.
                  </p>
                )}
                <section
                  aria-label="Resumo da métrica"
                  className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
                >
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      Agendamentos concluídos
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {formatCount(data.metric?.numerator)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">numerador</p>
                  </article>
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      Encaminhamentos humanos
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {formatCount(data.metric?.denominator)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">denominador</p>
                  </article>
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase text-slate-500">Métrica norte</p>
                    <p className="mt-2 text-3xl font-black">{formatRate(data.metric?.rate)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      somente quando a leitura está completa
                    </p>
                  </article>
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      Cobertura de atribuição
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {formatRate(data.coverage?.complete_rate)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCount(data.coverage?.attribution_received)} de{' '}
                      {formatCount(data.coverage?.total_submissions)} submissões
                    </p>
                  </article>
                  <article className="rounded-2xl border border-orange-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      Suficiência do baseline
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {formatRate(data.coverage?.sufficiency.complete_rate)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCount(data.coverage?.sufficiency.sufficient_submissions)} de{' '}
                      {formatCount(data.coverage?.total_submissions)} submissões · limiar{' '}
                      {formatRate(data.coverage?.sufficiency.threshold)}
                    </p>
                  </article>
                </section>
                <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                  Fórmula: {data.metric?.formula}. Período: {data.period?.from} a {data.period?.to}.
                  Versões fora da vigência/não verificáveis:{' '}
                  {formatCount(
                    (data.coverage?.version_validity?.fora_da_vigencia || 0) +
                      (data.coverage?.version_validity?.nao_verificavel || 0),
                  )}
                  . B3-04/B3-05:{' '}
                  {data.decisions?.b3_04_confirmed ? 'B3-04 confirmada' : 'B3-04 pendente'} /{' '}
                  {data.decisions?.b3_05_confirmed ? 'B3-05 confirmada' : 'B3-05 pendente'}.
                </p>
                <p className="mb-6 text-xs text-slate-500">
                  Por grupo: agendamentos concluídos ÷ encaminhamentos humanos. Cobertura de
                  atribuição = submissões com atribuição recebida ÷ total. Suficiência do baseline =
                  nome não vazio + telefone brasileiro reconhecível + proximidade elegível ÷ total;
                  limiar {formatRate(data.coverage?.sufficiency.threshold)}. Nenhum contato
                  individual é exibido.
                </p>

                <div className="space-y-5">
                  <Section
                    title="Por formulário e versão"
                    description="A vigência vem de published_at e termina na publicação da próxima versão do formulário."
                    rows={data.comparisons?.by_form_version || []}
                  />
                  <Section
                    title="Por origem (utm_source)"
                    description="Cada valor permanece separado, conforme taxonomia B3-01."
                    rows={data.comparisons?.by_source || []}
                  />
                  <Section
                    title="Por mídia (utm_medium)"
                    description="Cada valor permanece separado, conforme taxonomia B3-01."
                    rows={data.comparisons?.by_medium || []}
                  />
                  <Section
                    title="Por campanha (utm_campaign)"
                    description="Agrupamento por campanha; valores ausentes ou não reconhecidos ficam em grupo próprio."
                    rows={data.comparisons?.by_campaign || []}
                  />
                </div>

                <section className="mt-6 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                    Baseline versionado · append-only
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Histórico de congelamentos</h2>
                  {data.baselines?.length ? (
                    <ol className="mt-5 space-y-3">
                      {data.baselines.map((baseline) => (
                        <li
                          key={baseline.version}
                          className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
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
                          <p className="mt-2 text-sm">
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
                            {formatRate(baseline.sufficiency_threshold)}, {baseline.period_timezone}
                            ){baseline.reason ? ` · motivo: ${baseline.reason}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Critério registrado: {baseline.criterion}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      Nenhuma versão congelada; não há baseline presumido.
                    </p>
                  )}

                  {canFreeze &&
                    data.decisions?.b3_04_confirmed &&
                    data.decisions?.b3_05_confirmed &&
                    !data.preview &&
                    data.baseline_available !== false && (
                      <div className="mt-6 rounded-2xl bg-orange-50 p-5 dark:bg-orange-950/30">
                        <h3 className="font-bold">Congelar próxima versão · somente Champion</h3>
                        <p className="mt-1 text-sm">
                          Congela o mês civil completo anterior em America/Bahia. Cobertura abaixo
                          de 50% fica marcada como insuficiente; denominador zero fica não
                          calculável. B3-02 mantém o padrão móvel de 30 dias; fontes parciais
                          bloqueiam o congelamento.
                        </p>
                        <label className="mt-4 block text-sm font-semibold">
                          Motivo do congelamento
                          <textarea
                            required
                            maxLength={500}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                        <button
                          disabled={freezeBusy || data.partial}
                          onClick={() => void freeze()}
                          className="mt-3 min-h-11 rounded-xl bg-orange-600 px-5 font-bold text-white disabled:opacity-50"
                        >
                          {freezeBusy ? 'Congelando...' : 'Congelar baseline'}
                        </button>
                      </div>
                    )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default Dashboard
