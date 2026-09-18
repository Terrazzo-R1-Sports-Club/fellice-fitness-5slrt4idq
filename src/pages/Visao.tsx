import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'

// F2-IMP-008 / SPEC-2-002 — visão operacional com fila, escalada e rollback.
// Estado continua ENCAMINHAMENTO_HUMANO ao escalar/encerrar; a transição para
// CONCLUIDO segue exclusivamente a SPEC-2-001. Ações de liderança passam por
// rotas atômicas do servidor para preservar appointment + evento.

type Appointment = {
  id: string
  appointment_id: string
  lead_submission_id: string
  form_id: string
  form_version: string
  slot_id: string
  slot_datetime: string
  slot_duration_min: number
  nome: string
  telefone_ou_canal_de_retorno: string
  localidade: string
  profissao: string
  email?: string
  status: 'TENTATIVA' | 'CONCLUIDO' | 'DESISTENCIA' | 'ENCAMINHAMENTO_HUMANO'
  conflict_detected: boolean
  handoff_reason?: string
  created_at: string
  concluded_at?: string
  dono?: string
  assumed_at?: string
  responsavel_anterior?: string
  turno_origem?: 'MANHA' | 'TARDE' | 'NOITE' | 'FORA_TURNO'
  turno_fim_at?: string
  escalated_at?: string
  closed_at?: string
  motivo_encerramento?: string
  objetivo?: string
  proximidade?: string
  ocupacao?: string
  interesse_em_visita?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  attribution_status?: string
}

const STATUSES = ['TENTATIVA', 'CONCLUIDO', 'DESISTENCIA', 'ENCAMINHAMENTO_HUMANO'] as const

const STATUS_STYLE: Record<string, string> = {
  TENTATIVA: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  CONCLUIDO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  DESISTENCIA: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  ENCAMINHAMENTO_HUMANO: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
}

const formatDate = (value?: string) =>
  value ? new Date(value.replace(' ', 'T')).toLocaleString('pt-BR') : '—'

const Visao = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('TODOS')
  const [detail, setDetail] = useState<Appointment | null>(null)
  const [assuming, setAssuming] = useState('')
  const [myUserId, setMyUserId] = useState('')
  const [operating, setOperating] = useState('')
  const [operationReason, setOperationReason] = useState('')
  const [targetOwner, setTargetOwner] = useState('')
  const [queueEnabled, setQueueEnabled] = useState(true)
  const [rollbackReason, setRollbackReason] = useState('')
  const [myRole, setMyRole] = useState('')

  useEffect(() => {
    if (pb.authStore.isValid) {
      setMyUserId(pb.authStore.record?.id || '')
    }
  }, [])

  const load = async () => {
    if (!pb.authStore.isValid) return
    setLoading(true)
    setError('')
    try {
      const result = await pb
        .collection<Appointment>('lead_appointments')
        .getFullList({ sort: '-created_at' })
      setAppointments(result)
    } catch (err) {
      console.error(err)
      // Sessão órfã (usuário removido/token inválido): limpa e volta ao login —
      // a página nunca deve fingir que está autenticada com sessão inválida.
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) {
        pb.authStore.clear()
        setAppointments([])
        setError('Sua sessão expirou. Entre novamente, por favor.')
      } else {
        setError(
          'Não foi possível carregar a visão. Confirme que seu usuário tem o papel autorizado.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      if (!pb.authStore.isValid) return
      try {
        // valida a sessão contra o servidor (token de usuário removido é rejeitado)
        await pb.collection('users').authRefresh()
        setMyRole(String(pb.authStore.record?.role || ''))
        await load()
        await loadQueueControl()
      } catch (err) {
        console.error(err)
        pb.authStore.clear()
        setAppointments([])
        setLoginError('Sua sessão anterior não é mais válida. Entre com suas credenciais.')
      }
    }
    bootstrap()
  }, [])

  // F2-IMP-007 / CA-2.07: fila única — o primeiro consultor disponível assume a
  // tentativa em ENCAMINHAMENTO_HUMANO sem dono; o sistema registra dono + assumed_at
  // (assumed_at é gravado pelo servidor) + evento APPOINTMENT_ASSUMED na trilha.
  const canOperateQueue = myRole === 'champion' || myRole === 'gestao' || myRole === 'supervisora'

  const loadQueueControl = async () => {
    if (!pb.authStore.isValid) return
    try {
      const control = await pb.send<{ enabled: boolean }>('/backend/v1/queue/control', {
        method: 'GET',
      })
      setQueueEnabled(control.enabled)
    } catch (_) {
      // Consultores não precisam consultar o controle de rollback; mantém o padrão habilitado.
    }
  }

  const rollbackQueue = async (action: 'ROLLBACK' | 'RESTORE') => {
    if (!rollbackReason.trim()) {
      setError('Informe o motivo obrigatório do rollback/reativação.')
      return
    }
    setError('')
    try {
      await pb.send('/backend/v1/queue/rollback', {
        method: 'POST',
        body: JSON.stringify({ action, reason: rollbackReason.trim() }),
        headers: { 'Content-Type': 'application/json' },
      })
      setRollbackReason('')
      await loadQueueControl()
      await load()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível alterar o estado da fila.')
    }
  }

  const queueAction = async (action: 'ESCALATE' | 'REASSIGN' | 'CLOSE', appt: Appointment) => {
    if (!pb.authStore.isValid) return
    if (!operationReason.trim()) {
      setError('Informe o motivo obrigatório da ação.')
      return
    }
    if (action === 'REASSIGN' && !targetOwner.trim()) {
      setError('Informe o ID do novo responsável.')
      return
    }
    setOperating(appt.id)
    setError('')
    try {
      await pb.send('/backend/v1/queue/action', {
        method: 'POST',
        body: JSON.stringify({
          action,
          appointment_id: appt.appointment_id,
          reason: operationReason.trim(),
          target_owner: targetOwner.trim(),
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      setOperationReason('')
      setTargetOwner('')
      await load()
      await loadQueueControl()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível executar a ação operacional.')
    } finally {
      setOperating('')
    }
  }

  const assume = async (appt: Appointment) => {
    const userId = pb.authStore.record?.id || ''
    if (!pb.authStore.isValid || !userId) {
      setError('Sessão inválida — entre novamente antes de assumir o caso.')
      return
    }
    setAssuming(appt.id)
    setError('')
    try {
      await pb.send('/backend/v1/queue/action', {
        method: 'POST',
        body: JSON.stringify({
          action: 'ASSUME',
          appointment_id: appt.appointment_id,
          reason: 'Assunção da fila pelo primeiro Consultor disponível',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      setMyUserId(userId)
      await load()
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? `Não foi possível assumir: ${err.message}`
          : 'Não foi possível assumir a tentativa.',
      )
    } finally {
      setAssuming('')
    }
  }

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setLoginError('')
    try {
      await pb.collection('users').authWithPassword(email, password)
      const role = pb.authStore.record?.role
      if (
        role !== 'champion' &&
        role !== 'consultor' &&
        role !== 'gestao' &&
        role !== 'supervisora'
      ) {
        pb.authStore.clear()
        throw new Error('Papel não autorizado')
      }
      setMyRole(String(role || ''))
      await load()
      await loadQueueControl()
    } catch (err) {
      console.error(err)
      setLoginError('Login inválido ou usuário sem papel de Champion/Consultor Comercial.')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setAppointments([])
    setDetail(null)
  }

  const filtered =
    filter === 'TODOS' ? appointments : appointments.filter((a) => a.status === filter)

  const counts = STATUSES.map((s) => ({
    status: s,
    total: appointments.filter((a) => a.status === s).length,
  }))

  return (
    <main className="min-h-screen bg-[#fffaf5] px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold text-orange-600">
              ← Voltar ao formulário
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-orange-600">
              Fellice Fitness
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Visão operacional</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Tentativas de agendamento com contexto da triagem. Leitura — a conclusão vem da
              agenda.
            </p>
          </div>
          {pb.authStore.isValid && (
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
            >
              Sair
            </button>
          )}
        </div>

        {!pb.authStore.isValid ? (
          <form
            onSubmit={login}
            className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-2xl font-bold">Acesso operacional</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Entre com usuário autorizado como Champion ou Consultor Comercial.
            </p>
            <label className="mt-6 block text-sm font-semibold">
              E-mail
              <input
                required
                type="email"
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
              disabled={loading}
              className="mt-5 min-h-12 w-full rounded-xl bg-orange-600 px-4 font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar na visão'}
            </button>
          </form>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter('TODOS')}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    filter === 'TODOS'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  Todos ({appointments.length})
                </button>
                {counts.map(({ status, total }) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      filter === status
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {status} ({total})
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canOperateQueue && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                    <span
                      className={
                        queueEnabled
                          ? 'font-bold text-emerald-700 dark:text-emerald-300'
                          : 'font-bold text-red-700 dark:text-red-300'
                      }
                    >
                      Fila: {queueEnabled ? 'ativa' : 'em rollback'}
                    </span>
                    <input
                      aria-label="Motivo do rollback da fila"
                      value={rollbackReason}
                      onChange={(e) => setRollbackReason(e.target.value)}
                      placeholder="Motivo do controle"
                      className="min-h-9 w-48 rounded-lg border border-slate-200 px-2 dark:border-slate-700 dark:bg-slate-950"
                    />
                    {queueEnabled ? (
                      <button
                        onClick={() => rollbackQueue('ROLLBACK')}
                        className="rounded-lg border border-red-200 px-3 py-2 font-bold text-red-700"
                      >
                        Desativar ações
                      </button>
                    ) : (
                      <button
                        onClick={() => rollbackQueue('RESTORE')}
                        className="rounded-lg border border-emerald-200 px-3 py-2 font-bold text-emerald-700"
                      >
                        Reativar ações
                      </button>
                    )}
                  </div>
                )}
                <button
                  onClick={load}
                  className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-orange-700 dark:border-slate-700 dark:bg-slate-900 dark:text-orange-300"
                >
                  Atualizar
                </button>
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

            {loading ? (
              <p>Carregando tentativas...</p>
            ) : filtered.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-orange-200 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">
                Nenhuma tentativa neste estado.
              </p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {filtered.map((appt) => (
                  <article
                    key={appt.id}
                    className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold">{appt.nome || 'Sem nome'}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {appt.appointment_id} · {formatDate(appt.created_at)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[appt.status] || ''}`}
                      >
                        {appt.status}
                      </span>
                    </div>
                    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-500">Canal</dt>
                        <dd>{appt.telefone_ou_canal_de_retorno || '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Horário</dt>
                        <dd>
                          {appt.slot_id
                            ? `${formatDate(appt.slot_datetime)} (${appt.slot_duration_min} min)`
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Objetivo</dt>
                        <dd>{appt.objetivo || '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Origem</dt>
                        <dd>
                          {appt.attribution_status === 'recebida'
                            ? `${appt.utm_source} / ${appt.utm_medium} / ${appt.utm_campaign}`
                            : appt.attribution_status || '—'}
                        </dd>
                      </div>
                    </dl>
                    {appt.status === 'ENCAMINHAMENTO_HUMANO' && appt.handoff_reason && (
                      <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                        <strong>Motivo do encaminhamento:</strong> {appt.handoff_reason}
                      </p>
                    )}
                    {appt.status === 'ENCAMINHAMENTO_HUMANO' && (
                      <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <p>
                          {appt.dono
                            ? `Assumida por ${appt.dono === myUserId ? 'você' : appt.dono} em ${appt.assumed_at ? new Date(appt.assumed_at).toLocaleString('pt-BR') : '—'}`
                            : 'Sem dono — disponível para assunção (fila única).'}
                        </p>
                        {appt.turno_origem && (
                          <p>
                            Turno de origem: {appt.turno_origem} · fim:{' '}
                            {appt.turno_fim_at ? formatDate(appt.turno_fim_at) : 'fora da grade'}
                          </p>
                        )}
                        {appt.escalated_at && (
                          <p className="font-semibold text-red-700 dark:text-red-300">
                            Escalada em {formatDate(appt.escalated_at)}
                          </p>
                        )}
                        {!appt.escalated_at &&
                          !appt.closed_at &&
                          appt.turno_fim_at &&
                          new Date(appt.turno_fim_at).getTime() <= Date.now() && (
                            <p className="font-semibold text-red-700 dark:text-red-300">
                              Parada após o fim do turno — elegível para escalada visual.
                            </p>
                          )}
                        {appt.closed_at && (
                          <p className="font-semibold text-slate-700 dark:text-slate-200">
                            Encerrada em {formatDate(appt.closed_at)} · {appt.motivo_encerramento}
                          </p>
                        )}
                      </div>
                    )}
                    {appt.status === 'ENCAMINHAMENTO_HUMANO' && !appt.dono && queueEnabled && (
                      <button
                        disabled={assuming === appt.id}
                        onClick={() => assume(appt)}
                        className="mt-3 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {assuming === appt.id ? 'Assumindo...' : 'Assumir caso'}
                      </button>
                    )}
                    {canOperateQueue && queueEnabled && appt.status === 'ENCAMINHAMENTO_HUMANO' && (
                      <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Ações de Gestão / Supervisora
                        </p>
                        <input
                          aria-label="Motivo da ação operacional"
                          value={operating === appt.id ? operationReason : ''}
                          onChange={(e) => {
                            setOperating(appt.id)
                            setOperationReason(e.target.value)
                          }}
                          placeholder="Motivo obrigatório"
                          className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                        <input
                          aria-label="Novo responsável"
                          value={operating === appt.id ? targetOwner : ''}
                          onChange={(e) => {
                            setOperating(appt.id)
                            setTargetOwner(e.target.value)
                          }}
                          placeholder="ID do novo responsável (só reatribuição)"
                          className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            disabled={operating === appt.id}
                            onClick={() => queueAction('ESCALATE', appt)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
                          >
                            Sinalizar escalada
                          </button>
                          <button
                            disabled={operating === appt.id}
                            onClick={() => queueAction('REASSIGN', appt)}
                            className="rounded-lg border border-orange-200 px-3 py-2 text-xs font-bold text-orange-700 disabled:opacity-50"
                          >
                            Reatribuir
                          </button>
                          <button
                            disabled={operating === appt.id}
                            onClick={() => queueAction('CLOSE', appt)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
                          >
                            Encerrar sem agendamento
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setDetail(appt)}
                      className="mt-4 text-sm font-semibold text-orange-600 underline-offset-4 hover:underline"
                    >
                      Ver contexto completo
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-orange-100 bg-white p-7 dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold">{detail.nome || 'Sem nome'}</h3>
                <p className="mt-1 text-xs text-slate-500">{detail.appointment_id}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[detail.status] || ''}`}
              >
                {detail.status}
              </span>
            </div>

            <h4 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">
              Contexto da triagem
            </h4>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-500">Objetivo</dt>
                <dd>{detail.objetivo || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Proximidade</dt>
                <dd>{detail.proximidade || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Ocupação</dt>
                <dd>{detail.ocupacao || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Interesse</dt>
                <dd>{detail.interesse_em_visita || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Origem / campanha</dt>
                <dd>
                  {detail.attribution_status === 'recebida'
                    ? `${detail.utm_source} / ${detail.utm_medium} / ${detail.utm_campaign}`
                    : `Atribuição ${detail.attribution_status || 'ausente'}`}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Versão do formulário</dt>
                <dd>{detail.form_version}</dd>
              </div>
            </dl>

            <h4 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">
              Dados do agendamento
            </h4>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-500">Horário escolhido</dt>
                <dd>{detail.slot_id ? formatDate(detail.slot_datetime) : 'Sem horário'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Localidade</dt>
                <dd>{detail.localidade || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Profissão</dt>
                <dd>{detail.profissao || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Criada em</dt>
                <dd>{formatDate(detail.created_at)}</dd>
              </div>
              {detail.concluded_at && (
                <div>
                  <dt className="font-semibold text-slate-500">Concluída em</dt>
                  <dd>{formatDate(detail.concluded_at)}</dd>
                </div>
              )}
              {detail.status === 'ENCAMINHAMENTO_HUMANO' && detail.handoff_reason && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-slate-500">Motivo do encaminhamento</dt>
                  <dd>{detail.handoff_reason}</dd>
                </div>
              )}
            </dl>

            <button
              onClick={() => setDetail(null)}
              className="mt-6 min-h-12 w-full rounded-xl bg-orange-600 px-5 font-bold text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default Visao
