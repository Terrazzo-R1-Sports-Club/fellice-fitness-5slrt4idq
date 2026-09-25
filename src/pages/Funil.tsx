import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'

type FunnelStages = {
  entrada: number | null
  inicio: number | null
  triagem_concluida: number | null
  encaminhamento_humano: number | null
  agendamento_concluido: number | null
}

type FunnelData = {
  enabled: boolean
  available: boolean
  message?: string
  partial?: boolean
  period?: { from: string; to: string }
  stages?: FunnelStages
  metric?: {
    name: string
    numerator: number | null
    denominator: number | null
    rate: number | null
    formula: string
  }
  coverage?: {
    total_submissoes: number
    atribuicao_recebida: number
    atribuicao_incompleta: number
    atribuicao_ausente: number
    atribuicao_nao_reconhecida: number
    sem_attribution_status: number
    cobertura_completa: number | null
  } | null
  linkage?: {
    agendamentos_relevantes: number
    agendamentos_sem_submissao: number
    cobertura_incompleta: boolean
  } | null
  deduplication?: {
    appointment_ids: number
    human_handoff_keys: number
  }
  sources?: Record<string, string>
  read_errors?: string[]
  control?: { updated_at: string; reason: string }
}

const allowedRoles = ['champion', 'gestao', 'supervisora']

const pad = (value: number) => String(value).padStart(2, '0')

const defaultPeriod = () => {
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 29)
  return { from: toDateInput(from), to: toDateInput(to) }
}

const toDateInput = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

const formatCount = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('pt-BR')

const formatRate = (value: number | null | undefined) =>
  value === null || value === undefined ? 'Sem taxa calculável' : `${(value * 100).toFixed(1)}%`

const errorStatus = (error: unknown) => (error as { status?: number })?.status || 0

const Funnel = () => {
  const initialPeriod = defaultPeriod()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<FunnelData | null>(null)
  const [from, setFrom] = useState(initialPeriod.from)
  const [to, setTo] = useState(initialPeriod.to)
  const [controlReason, setControlReason] = useState('')
  const [controlBusy, setControlBusy] = useState(false)

  const authenticated = pb.authStore.isValid
  const role = String(pb.authStore.record?.role || '')
  const canControl = role === 'champion' || role === 'gestao' || role === 'supervisora'

  const load = async () => {
    if (!pb.authStore.isValid) return
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ from, to }).toString()
      const result = await pb.send<FunnelData>(`/backend/v1/funnel?${query}`, { method: 'GET' })
      setData(result)
    } catch (err) {
      console.error(err)
      if (errorStatus(err) === 401 || errorStatus(err) === 403) {
        pb.authStore.clear()
        setData(null)
        setError(
          'Sua sessão não tem acesso à consolidação. Entre novamente com um papel autorizado.',
        )
      } else {
        setError('Não foi possível carregar a consolidação agora.')
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
        setData(null)
        setLoginError('Sua sessão anterior não é mais válida. Entre novamente.')
      }
    }
    bootstrap()
  }, [])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginBusy(true)
    setLoginError('')
    setError('')
    try {
      await pb.collection('users').authWithPassword(email, password)
      if (!allowedRoles.includes(String(pb.authStore.record?.role || ''))) {
        pb.authStore.clear()
        setLoginError(
          'Autenticação realizada, mas este papel não tem acesso aos agregados da consolidação. Use Champion, Gestão ou Supervisora.',
        )
        return
      }
      await load()
    } catch (err) {
      console.error(err)
      setLoginError(
        'Não foi possível autenticar. Verifique se a conta existe neste ambiente e se a senha está correta; por segurança, o sistema não distingue conta inexistente de senha incorreta.',
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

  const control = async (action: 'ROLLBACK' | 'RESTORE') => {
    if (!controlReason.trim()) {
      setError('Informe o motivo obrigatório do controle.')
      return
    }
    setControlBusy(true)
    setError('')
    try {
      await pb.send('/backend/v1/funnel/control', {
        method: 'POST',
        body: JSON.stringify({ action, reason: controlReason.trim() }),
        headers: { 'Content-Type': 'application/json' },
      })
      setControlReason('')
      await load()
    } catch (err) {
      console.error(err)
      setError('Não foi possível alterar o controle da consolidação.')
    } finally {
      setControlBusy(false)
    }
  }

  const stages = data?.stages
  const metric = data?.metric
  const coverage = data?.coverage
  const linkage = data?.linkage
  const stageCards = [
    ['Entrada', stages?.entrada],
    ['Início da triagem', stages?.inicio],
    ['Triagem concluída', stages?.triagem_concluida],
    ['Encaminhamento humano', stages?.encaminhamento_humano],
    ['Agendamento concluído', stages?.agendamento_concluido],
  ] as const

  return (
    <main className="min-h-screen bg-[#fffaf5] px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold text-orange-600">
              ← Voltar ao formulário
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-orange-600">
              Fellice Fitness · Fase 3
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Funil de conversão</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              Consolidação somente leitura. Exibe agregados por período, sem nome, telefone, e-mail
              ou registros individuais.
            </p>
          </div>
          {authenticated && (
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
            >
              Sair
            </button>
          )}
        </div>

        {!authenticated ? (
          <form
            onSubmit={login}
            className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-2xl font-bold">Acesso aos agregados</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Use um usuário autorizado para consultar a consolidação sem dados de contato.
            </p>
            <label className="mt-6 block text-sm font-semibold">
              E-mail
              <input
                required
                type="email"
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
              {loginBusy ? 'Entrando...' : 'Entrar na consolidação'}
            </button>
          </form>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border border-orange-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm font-semibold">
                  De
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="mt-2 block min-h-11 rounded-xl border border-slate-200 px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Até
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="mt-2 block min-h-11 rounded-xl border border-slate-200 px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <button
                  onClick={load}
                  disabled={loading}
                  className="min-h-11 rounded-xl bg-orange-600 px-5 font-bold text-white disabled:opacity-50"
                >
                  {loading ? 'Atualizando...' : 'Atualizar período'}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Padrão aprovado: últimos 30 dias corridos.
                </p>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300"
              >
                {error}
              </p>
            )}
            {data?.partial && (
              <p
                role="status"
                className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                Leitura parcial: existe fonte indisponível. A taxa não é apresentada como completa.
                {data.read_errors?.length ? ` Fontes: ${data.read_errors.join(', ')}.` : ''}
              </p>
            )}
            {data && !data.available && (
              <p
                role="status"
                className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200"
              >
                {data.message || 'A consolidação está desativada.'}
              </p>
            )}

            {data?.available && stages && (
              <>
                <section aria-label="Etapas do funil" className="grid gap-4 md:grid-cols-5">
                  {stageCards.map(([label, value]) => (
                    <article
                      key={label}
                      className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {label}
                      </p>
                      <p className="mt-3 text-3xl font-black">{formatCount(value)}</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        registros únicos no período
                      </p>
                    </article>
                  ))}
                </section>

                <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <article className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                      Métrica norte
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{metric?.name}</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {metric?.formula}
                    </p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/40">
                        <p className="text-xs font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                          Numerador
                        </p>
                        <p className="mt-2 text-2xl font-black">{formatCount(metric?.numerator)}</p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          agendamentos concluídos
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          Denominador
                        </p>
                        <p className="mt-2 text-2xl font-black">
                          {formatCount(metric?.denominator)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          encaminhamentos humanos
                        </p>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          Taxa
                        </p>
                        <p className="mt-2 text-2xl font-black">{formatRate(metric?.rate)}</p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          somente com leitura completa
                        </p>
                      </div>
                    </div>
                    <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
                      Período: {data.period?.from} a {data.period?.to}
                    </p>
                  </article>

                  <article className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                      Cobertura de atribuição
                    </p>
                    <h2 className="mt-2 text-2xl font-black">
                      {formatRate(coverage?.cobertura_completa)}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Submissões com origem completa no período.
                    </p>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt>Submissões</dt>
                        <dd className="font-bold">{formatCount(coverage?.total_submissoes)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Atribuição recebida</dt>
                        <dd className="font-bold text-emerald-700 dark:text-emerald-300">
                          {formatCount(coverage?.atribuicao_recebida)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Atribuição incompleta</dt>
                        <dd className="font-bold">
                          {formatCount(coverage?.atribuicao_incompleta)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Atribuição ausente</dt>
                        <dd className="font-bold">{formatCount(coverage?.atribuicao_ausente)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Status ausente/não reconhecido</dt>
                        <dd className="font-bold">
                          {formatCount(
                            (coverage?.sem_attribution_status || 0) +
                              (coverage?.atribuicao_nao_reconhecida || 0),
                          )}
                        </dd>
                      </div>
                    </dl>
                  </article>
                </section>

                <section className="mt-6 grid gap-5 md:grid-cols-2">
                  <article className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                      Vínculo triagem → agendamento
                    </p>
                    <h2 className="mt-2 text-2xl font-black">
                      {linkage?.cobertura_incompleta
                        ? 'Cobertura incompleta'
                        : 'Sem órfãos detectados'}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Nenhum vínculo é inventado por nome, telefone ou outro dado.
                    </p>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt>Agendamentos relevantes</dt>
                        <dd className="font-bold">
                          {formatCount(linkage?.agendamentos_relevantes)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Sem submissão correspondente</dt>
                        <dd className="font-bold text-orange-700 dark:text-orange-300">
                          {formatCount(linkage?.agendamentos_sem_submissao)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                  <article className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                      Determinismo
                    </p>
                    <h2 className="mt-2 text-2xl font-black">Deduplicação ativa</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Reprocessamento e reagendamento não criam contagens adicionais.
                    </p>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt>appointment_id únicos concluídos</dt>
                        <dd className="font-bold">
                          {formatCount(data.deduplication?.appointment_ids)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>chaves de encaminhamento</dt>
                        <dd className="font-bold">
                          {formatCount(data.deduplication?.human_handoff_keys)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                </section>
              </>
            )}

            {canControl && (
              <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Controle de segurança
                </p>
                <h2 className="mt-2 text-xl font-black">Rollback sem apagar eventos</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Desativa apenas a leitura da consolidação; as fontes e seus eventos permanecem
                  preservados.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <input
                    aria-label="Motivo do controle da consolidação"
                    value={controlReason}
                    onChange={(event) => setControlReason(event.target.value)}
                    placeholder="Motivo obrigatório"
                    className="min-h-11 min-w-72 flex-1 rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
                  />
                  {data?.enabled ? (
                    <button
                      disabled={controlBusy}
                      onClick={() => control('ROLLBACK')}
                      className="min-h-11 rounded-xl border border-red-200 px-4 font-bold text-red-700 disabled:opacity-50"
                    >
                      Desativar consolidação
                    </button>
                  ) : (
                    <button
                      disabled={controlBusy}
                      onClick={() => control('RESTORE')}
                      className="min-h-11 rounded-xl border border-emerald-200 px-4 font-bold text-emerald-700 disabled:opacity-50"
                    >
                      Reativar consolidação
                    </button>
                  )}
                </div>
                {data?.control?.reason && (
                  <p className="mt-3 text-xs text-slate-500">
                    Último controle: {data.control.reason}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default Funnel
