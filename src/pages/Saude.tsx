import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'

type ComparisonGroup = {
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

type SyncControlEvent = {
  event_id: string
  action: string
  occurred_at: string
  actor_id: string
  reason: string
  previous_enabled?: boolean
  enabled?: boolean
}

type FailureWithOwner = {
  evento_id: string
  tipo: string
  responsavel: string
  responsavel_id: string
  data: string
  detalhe: string
}

type ConflictItem = {
  appointment_id: string
  responsavel: string
  responsavel_id: string
  status: string
  data: string
  detalhe: string
}

type DivergenceItem = {
  tipo: string
  referencia_id: string
  responsavel: string
  responsavel_id: string
  detalhe: string
  detectado_em: string
}

type AuditItem = {
  event_id: string
  origem: string
  acao: string
  autor: string
  autor_id: string
  data: string
}

type IntegrationHealthResult = {
  available: boolean
  partial?: boolean
  read_errors?: string[]
  sources?: Record<string, string>
  sync_control?: {
    enabled: boolean
    updated_at: string
    updated_by: string
    reason: string
    events: SyncControlEvent[]
  }
  queue_state?: {
    metrics: {
      pendentes: number
      assumidos: number
      encerrados_sem_agendamento: number
      falhas_com_dono: number
      falhas_sem_dono: number
      conflitos: number
      reprocessados: number
      divergencias: number
    }
    failures_with_owner: FailureWithOwner[]
    conflicts: ConflictItem[]
    divergences: DivergenceItem[]
  }
  conversion?: {
    period: { from: string; to: string }
    formula: string
    baseline_period: string
    metric: {
      name: string
      numerator: number | null
      denominator: number | null
      rate: number | null
    }
    coverage: {
      total_submissions: number
      attribution_received: number
      attribution_incomplete: number
      attribution_absent: number
      attribution_unknown: number
      complete_rate: number | null
      is_incomplete: boolean
    }
    comparisons: {
      by_form_version: ComparisonGroup[]
      by_campaign: ComparisonGroup[]
    }
  }
  audit_trail?: AuditItem[]
  policy?: {
    b4_03_confirmed: boolean
    read_roles: string[]
    note?: string
  }
}

const ALLOWED_ROLES = ['champion', 'gestao', 'supervisora', 'subgerente']

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

const formatDateTime = (value?: string) =>
  value ? new Date(value.replace(' ', 'T')).toLocaleString('pt-BR') : '—'

const statusFor = (err: unknown) => (err as { status?: number })?.status || 0

const Saude = () => {
  const initial = defaultPeriod()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [error, setError] = useState('')
  const [data, setData] = useState<IntegrationHealthResult | null>(null)
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [loading, setLoading] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)

  const authenticated = pb.authStore.isValid
  const role = String(pb.authStore.record?.role || '')
  const canRead = ALLOWED_ROLES.includes(role)

  const load = async () => {
    if (!pb.authStore.isValid) return
    setLoading(true)
    setError('')
    try {
      const result = await pb.send<IntegrationHealthResult>('/backend/v1/integration-health', {
        method: 'POST',
        body: JSON.stringify({ action: 'read', from, to }),
        headers: { 'Content-Type': 'application/json' },
      })
      setData(result)
    } catch (err) {
      console.error(err)
      const st = statusFor(err)
      if (st === 401) {
        pb.authStore.clear()
        setData(null)
        setError('Sua sessão expirou. Entre novamente.')
      } else if (st === 403) {
        setData(null)
        setError('Seu papel não está autorizado pela matriz de acesso do painel de saúde.')
      } else {
        setError('Não foi possível consultar os dados de saúde da integração no momento.')
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
        const currentRole = String(pb.authStore.record?.role || '')
        if (!ALLOWED_ROLES.includes(currentRole)) {
          pb.authStore.clear()
          setData(null)
          setLoginError('Este papel não está autorizado a consultar o painel de saúde.')
          return
        }
        await load()
      } catch (err) {
        console.error(err)
        pb.authStore.clear()
        setLoginError('Sua sessão anterior não é mais válida. Entre com suas credenciais.')
      }
    }
    void bootstrap()
  }, [])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginBusy(true)
    setLoginError('')
    try {
      await pb.collection('users').authWithPassword(email, password)
      const currentRole = String(pb.authStore.record?.role || '')
      if (!ALLOWED_ROLES.includes(currentRole)) {
        pb.authStore.clear()
        setLoginError('Este papel não está autorizado pela matriz de acesso (B4-03).')
        return
      }
      await load()
    } catch (err) {
      console.error(err)
      setLoginError('Não foi possível autenticar. Verifique suas credenciais de acesso.')
    } finally {
      setLoginBusy(false)
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setData(null)
    setError('')
  }

  const runQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void load()
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] px-5 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:py-10">
      <div className="mx-auto max-w-7xl">
        {/* Cabeçalho */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold text-orange-600 hover:underline">
              ← Voltar ao formulário
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-orange-600">
              Terrazzo R1 Sports Club / Fellice Fitness · Fase 4
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">
              Saúde da Integração de Leads
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              Monitoramento operacional, fila de sincronização, pendências com responsável,
              conversão por formulário/campanha e trilha append-only. Nenhum contato individual de
              lead é exposto.
            </p>
          </div>
          {authenticated && (
            <button
              onClick={logout}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Sair
            </button>
          )}
        </header>

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
          >
            {error}
          </p>
        )}

        {/* Bloqueio de login e de papéis fora da matriz (CA-4-006 / CA-4-007) */}
        {!authenticated ? (
          <form
            onSubmit={login}
            className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-2xl font-bold">Acesso à Saúde da Integração</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Disponível exclusivamente para papéis autorizados pela matriz B4-03: Champion, Gestão,
              Supervisora e Subgerente.
            </p>
            <label className="mt-6 block text-sm font-semibold">
              E-mail
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
              className="mt-5 min-h-12 w-full rounded-xl bg-orange-600 px-4 font-bold text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              {loginBusy ? 'Entrando...' : 'Entrar no painel de saúde'}
            </button>
          </form>
        ) : !canRead ? (
          <section
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <h2 className="text-lg font-bold">Acesso restrito</h2>
            <p className="mt-1 text-sm">
              Seu papel atual (<code>{role || 'indefinido'}</code>) não possui permissão de leitura
              no Painel de Saúde da Integração. Matriz restrita a: {ALLOWED_ROLES.join(', ')}.
            </p>
          </section>
        ) : (
          <>
            {/* Filtro por período */}
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
                  onChange={(e) => setFrom(e.target.value)}
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
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-2 block min-h-11 rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <button
                disabled={loading}
                className="min-h-11 rounded-xl bg-orange-600 px-5 font-bold text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? 'Consultando...' : 'Atualizar métricas'}
              </button>
            </form>

            {/* Aviso de degradação / falha de fonte (CA-4-008 / CA-4-009) */}
            {data?.partial && (
              <aside
                role="status"
                className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
              >
                <div className="flex items-center gap-2 font-bold">
                  <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
                  Degradação detectada (source_unavailable): Leitura parcial de fontes
                </div>
                <p className="mt-2">
                  As seguintes fontes falharam ou estão indisponíveis:{' '}
                  <strong>{data.read_errors?.join(', ') || 'nenhuma identificada'}</strong>. Em
                  respeito à regra de integridade,{' '}
                  <em>nunca fabricamos zero nem inventamos números</em>; as taxas que dependem
                  dessas fontes permanecem marcadas como incompletas.
                </p>
              </aside>
            )}

            {/* 1. ESTADO DA INTEGRAÇÃO E DA FILA */}
            <section
              aria-labelledby="section-fila"
              className="mb-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                    Operação e Sincronização
                  </p>
                  <h2 id="section-fila" className="mt-1 text-2xl font-black">
                    Estado da Fila de Integração
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-3 w-3 rounded-full ${
                      data?.sync_control?.enabled ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm font-bold">
                    Sincronização:{' '}
                    {data?.sync_control?.enabled ? 'Habilitada' : 'Desabilitada (Rollback)'}
                  </span>
                </div>
              </div>

              {/* Cards de Métricas da Fila */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-xs font-bold uppercase text-slate-500">Pendentes na fila</p>
                  <p className="mt-2 text-3xl font-black text-amber-600">
                    {formatCount(data?.queue_state?.metrics.pendentes)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">aguardando assunção humana</p>
                </article>

                <article className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-xs font-bold uppercase text-slate-500">Casos assumidos</p>
                  <p className="mt-2 text-3xl font-black text-blue-600">
                    {formatCount(data?.queue_state?.metrics.assumidos)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">em atendimento com consultor</p>
                </article>

                <article className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-xs font-bold uppercase text-slate-500">Reprocessados</p>
                  <p className="mt-2 text-3xl font-black text-purple-600">
                    {formatCount(data?.queue_state?.metrics.reprocessados)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">reatribuições / reprocessamento</p>
                </article>

                <article className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-xs font-bold uppercase text-slate-500">Falhas / Conflitos</p>
                  <p className="mt-2 text-3xl font-black text-red-600">
                    {formatCount(
                      (data?.queue_state?.metrics.conflitos || 0) +
                        (data?.queue_state?.metrics.falhas_com_dono || 0) +
                        (data?.queue_state?.metrics.divergencias || 0),
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">com responsável atribuído</p>
                </article>
              </div>

              {/* Subseção: Falhas com Dono e Pendências */}
              <div className="mt-8">
                <h3 className="text-lg font-bold">Pendências e Falhas com Dono</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Toda falha ou divergência carrega um responsável obrigatório; nunca reconciliamos
                  silenciosamente.
                </p>

                {!data?.queue_state?.failures_with_owner.length &&
                !data?.queue_state?.conflicts.length &&
                !data?.queue_state?.divergences.length ? (
                  <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Nenhuma falha ativa com responsável, conflito ou divergência detectada no
                    momento.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {data?.queue_state?.divergences.map((div, i) => (
                      <div
                        key={`div-${i}`}
                        className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm dark:border-red-900 dark:bg-red-950/30"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-red-700 dark:text-red-300">
                            Divergência: {div.tipo}
                          </span>
                          <span className="text-xs text-slate-500">
                            Detectado em: {formatDateTime(div.detectado_em)}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700 dark:text-slate-200">{div.detalhe}</p>
                        <p className="mt-2 text-xs font-semibold text-red-800 dark:text-red-200">
                          Responsável pela resolução: {div.responsavel} (Ref: {div.referencia_id})
                        </p>
                      </div>
                    ))}

                    {data?.queue_state?.conflicts.map((conf, i) => (
                      <div
                        key={`conf-${i}`}
                        className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-amber-800 dark:text-amber-200">
                            Conflito de Agendamento ({conf.appointment_id})
                          </span>
                          <span className="text-xs text-slate-500">
                            Registrado em: {formatDateTime(conf.data)}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700 dark:text-slate-200">{conf.detalhe}</p>
                        <p className="mt-2 text-xs font-semibold text-amber-900 dark:text-amber-100">
                          Responsável pelo caso: {conf.responsavel}
                        </p>
                      </div>
                    ))}

                    {data?.queue_state?.failures_with_owner.map((fail, i) => (
                      <div
                        key={`fail-${i}`}
                        className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm dark:border-red-900 dark:bg-red-950/30"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-red-800 dark:text-red-200">
                            Falha Operacional: {fail.tipo}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDateTime(fail.data)}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700 dark:text-slate-200">{fail.detalhe}</p>
                        <p className="mt-2 text-xs font-semibold text-red-900 dark:text-red-100">
                          Dono do evento: {fail.responsavel}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subseção: Últimos Eventos de Controle de Sincronização */}
              <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
                <h3 className="text-lg font-bold">Eventos de Controle de Sincronização</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Histórico de ROLLBACK e RESTORE registrado em{' '}
                  <code>lead_sync_control_events</code>.
                </p>

                {data?.sync_control?.events.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                          <th className="py-2 pr-3">Ação</th>
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Autor</th>
                          <th className="pl-3 py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.sync_control.events.map((ev) => (
                          <tr
                            key={ev.event_id}
                            className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                          >
                            <td className="py-2.5 pr-3 font-semibold">
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-bold ${
                                  ev.action === 'RESTORE'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                }`}
                              >
                                {ev.action}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">
                              {formatDateTime(ev.occurred_at)}
                            </td>
                            <td className="px-3 py-2.5">{ev.actor_id}</td>
                            <td className="pl-3 py-2.5 text-slate-600 dark:text-slate-300">
                              {ev.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    Nenhum evento de controle registrado.
                  </p>
                )}
              </div>
            </section>

            {/* 2. CONVERSÃO POR FORMULÁRIO E CAMPANHA (Fórmula Fase 3) */}
            <section
              aria-labelledby="section-conversao"
              className="mb-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                  Métrica Norte e Desempenho
                </p>
                <h2 id="section-conversao" className="mt-1 text-2xl font-black">
                  Conversão por Formulário e Campanha
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Fórmula oficial: <code>{data?.conversion?.formula}</code> · Período:{' '}
                  <strong>
                    {data?.conversion?.period.from} até {data?.conversion?.period.to}
                  </strong>{' '}
                  ({data?.conversion?.baseline_period})
                </p>
              </div>

              {/* Destaque da Métrica Norte */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Agendamentos Concluídos
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {formatCount(data?.conversion?.metric.numerator)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">numerador do período</p>
                </article>

                <article className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Encaminhamentos Humanos
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {formatCount(data?.conversion?.metric.denominator)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">denominador do período</p>
                </article>

                <article className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs font-bold uppercase text-slate-500">Taxa de Conversão</p>
                  <p className="mt-2 text-3xl font-black text-orange-600">
                    {formatRate(data?.conversion?.metric.rate)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {data?.partial
                      ? 'Não calculável (leitura de fonte parcial)'
                      : 'válida com cobertura completa'}
                  </p>
                </article>

                <article className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Cobertura de Atribuição
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {formatRate(data?.conversion?.coverage.complete_rate)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatCount(data?.conversion?.coverage.attribution_received)} de{' '}
                    {formatCount(data?.conversion?.coverage.total_submissions)} submissões
                  </p>
                </article>
              </div>

              {/* Tabela de Formulários e Versões */}
              <div className="mt-8">
                <h3 className="text-lg font-bold">Por Formulário e Versão</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Vigência e taxas por versão de formulário capturado.
                </p>
                {data?.conversion?.comparisons.by_form_version.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                          <th className="py-2 pr-3">Formulário / Versão</th>
                          <th className="px-3 py-2 text-right">Submissões</th>
                          <th className="px-3 py-2 text-right">Encaminhamentos</th>
                          <th className="px-3 py-2 text-right">Agendamentos</th>
                          <th className="px-3 py-2 text-right">Taxa</th>
                          <th className="pl-3 py-2 text-right">Cobertura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.conversion.comparisons.by_form_version.map((row) => (
                          <tr
                            key={row.key}
                            className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                          >
                            <td className="py-3 pr-3 font-semibold">
                              <span>{row.label}</span>
                              {row.validity && (
                                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                                  Vigência: {row.valid_from || 'não verificada'}
                                  {row.valid_to ? ` a ${row.valid_to}` : ' em diante'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">{formatCount(row.submissions)}</td>
                            <td className="px-3 py-3 text-right">
                              {formatCount(row.human_handoffs)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {formatCount(row.completed_appointments)}
                            </td>
                            <td className="px-3 py-3 text-right">{formatRate(row.rate)}</td>
                            <td className="pl-3 py-3 text-right">{formatRate(row.coverage)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Nenhum dado de formulário para o período selecionado.
                  </p>
                )}
              </div>

              {/* Tabela de Campanhas */}
              <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
                <h3 className="text-lg font-bold">Por Campanha (utm_campaign)</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Agrupamento estrito por campanha UTM recebida.
                </p>
                {data?.conversion?.comparisons.by_campaign.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                          <th className="py-2 pr-3">Campanha</th>
                          <th className="px-3 py-2 text-right">Submissões</th>
                          <th className="px-3 py-2 text-right">Encaminhamentos</th>
                          <th className="px-3 py-2 text-right">Agendamentos</th>
                          <th className="px-3 py-2 text-right">Taxa</th>
                          <th className="pl-3 py-2 text-right">Cobertura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.conversion.comparisons.by_campaign.map((row) => (
                          <tr
                            key={row.key}
                            className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                          >
                            <td className="py-3 pr-3 font-semibold">{row.label}</td>
                            <td className="px-3 py-3 text-right">{formatCount(row.submissions)}</td>
                            <td className="px-3 py-3 text-right">
                              {formatCount(row.human_handoffs)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {formatCount(row.completed_appointments)}
                            </td>
                            <td className="px-3 py-3 text-right">{formatRate(row.rate)}</td>
                            <td className="pl-3 py-3 text-right">{formatRate(row.coverage)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Nenhuma campanha registrada no período selecionado.
                  </p>
                )}
              </div>
            </section>

            {/* 3. HISTÓRICO APPEND-ONLY DAS ALTERAÇÕES DE ENCAMINHAMENTO E AGENDAMENTO */}
            <section
              aria-labelledby="section-auditoria"
              className="mb-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                  Trilha Imutável · Append-Only
                </p>
                <h2 id="section-auditoria" className="mt-1 text-2xl font-black">
                  Histórico de Alterações Operacionais
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Eventos consolidados de <code>lead_handoff_events</code> e{' '}
                  <code>lead_appointment_events</code>. Rollbacks não apagam eventos de origem;
                  identificadores pessoais e contatos individuais são preservados fora desta visão.
                </p>
              </div>

              {data?.audit_trail?.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                        <th className="py-2 pr-3">Event ID</th>
                        <th className="px-3 py-2">Origem</th>
                        <th className="px-3 py-2">Ação</th>
                        <th className="px-3 py-2">Autor / Responsável</th>
                        <th className="pl-3 py-2 text-right">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.audit_trail.map((item) => (
                        <tr
                          key={item.event_id}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                        >
                          <td className="py-3 pr-3 font-mono text-xs text-slate-500">
                            {item.event_id}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                            <code>{item.origem}</code>
                          </td>
                          <td className="px-3 py-3 font-semibold">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold dark:bg-slate-800">
                              {item.acao}
                            </span>
                          </td>
                          <td className="px-3 py-3">{item.autor}</td>
                          <td className="pl-3 py-3 text-right text-xs text-slate-500">
                            {formatDateTime(item.data)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Nenhum evento operacional encontrado no histórico.
                </p>
              )}
            </section>

            {/* Rodapé institucional com política B4-03 */}
            <footer className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <p>
                <strong>Política B4-03:</strong>{' '}
                {data?.policy?.b4_03_confirmed
                  ? 'Confirmada'
                  : 'Pendente de validação documental no repositório'}
                . Matriz ativa:{' '}
                <code>{data?.policy?.read_roles?.join(', ') || ALLOWED_ROLES.join(', ')}</code>.
              </p>
              <p className="mt-1">
                Conforme diretriz de segurança e privacidade: nenhuma funcionalidade de exportação
                de dados de lead ou contato individual é disponibilizada neste painel.
              </p>
            </footer>
          </>
        )}
      </div>
    </main>
  )
}

export default Saude
