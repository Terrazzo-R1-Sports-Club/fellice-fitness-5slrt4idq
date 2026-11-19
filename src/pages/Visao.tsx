import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { rotuloPrioridade } from '@/lib/prioridade'

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
  prioridade_nota?: number
  prioridade_faixa?: 'alta' | 'media' | 'baixa' | 'sem_pontuacao'
  prioridade_matriz?: string
  prioridade_motivo?: string
  sem_perfil_at?: string
  sem_perfil_motivo?: string
  sem_perfil_por?: string
}

const STATUSES = ['TENTATIVA', 'CONCLUIDO', 'DESISTENCIA', 'ENCAMINHAMENTO_HUMANO'] as const

const STATUS_STYLE: Record<string, string> = {
  TENTATIVA: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  CONCLUIDO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  DESISTENCIA: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  ENCAMINHAMENTO_HUMANO: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
}

// REF-08: rótulos de exibição — nenhum valor interno muda; status sem entrada no
// mapa continua sendo exibido com o valor cru (ex.: ENCAMINHAMENTO_HUMANO).
const STATUS_LABELS: Record<string, string> = {
  TENTATIVA: 'Em andamento',
  CONCLUIDO: 'Agendado',
  DESISTENCIA: 'Sem interesse',
}

const formatDate = (value?: string) =>
  value ? new Date(value.replace(' ', 'T')).toLocaleString('pt-BR') : '—'

// REF-09 r2 — o Agendar exibe o horário do slot como gravado (string crua,
// sem conversão de fuso); o painel de reagendamento segue a MESMA convenção
// para o operador ver o mesmo horário que o lead vê no formulário.
const formatSlotDia = (iso: string) => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}
const formatSlotHora = (iso: string) => iso.slice(11, 16)
const formatSlotRotulo = (iso: string) => `${formatSlotDia(iso)} ${formatSlotHora(iso)}`

// REF-09 — slot ABERTO com vaga, mesma leitura pública do Agendar (RN-2.01):
// agenda_slots ABERTO + ocupação real de agenda_slot_occupancy; slot cheio
// (active >= capacity) não é ofertado.
type RescheduleSlot = {
  slot_id: string
  slot_datetime: string
  slot_duration_min: number
  capacity: number
  active: number
}

type RescheduleSlotBase = {
  slot_id: string
  slot_datetime: string
  slot_duration_min: number
  capacity?: number
}

type OccupancyRow = {
  slot_id: string
  capacity: number
  active: number
}

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
  const [operating, setOperating] = useState('')
  const [operationReason, setOperationReason] = useState('')
  const [targetOwner, setTargetOwner] = useState('')
  const [queueEnabled, setQueueEnabled] = useState(true)
  const [rollbackReason, setRollbackReason] = useState('')
  const [myRole, setMyRole] = useState('')
  // REF-09 — reagendamento pelo operador (única ação de escrita da Visão).
  const [rescheduling, setRescheduling] = useState('') // id do appt em envio
  const [rescheduleSlots, setRescheduleSlots] = useState<RescheduleSlot[]>([])
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [rescheduleError, setRescheduleError] = useState('')
  const [reschedulePick, setReschedulePick] = useState('') // slot_id escolhido
  const [rescheduleOpen, setRescheduleOpen] = useState(false) // painel aberto no modal
  const [rescheduleConfirm, setRescheduleConfirm] = useState(false) // confirmação exibida
  const [rescheduleDone, setRescheduleDone] = useState('') // mensagem de sucesso
  // REF-10 — classificação "Sem perfil" (manual, pelo operador; reversível com motivo;
  // a reserva NÃO é alterada — liberação, se necessária, usa o reagendamento/encerramento).
  const [classifying, setClassifying] = useState('') // id do appt em envio
  const [classReason, setClassReason] = useState('') // motivo obrigatório
  const [classError, setClassError] = useState('')
  const [classDone, setClassDone] = useState('')
  const [classOpen, setClassOpen] = useState(false) // painel aberto no modal

  // Identidade lida do authStore NO RENDER — nunca estado capturado no mount:
  // login/logout na mesma montagem não podem deixar a comparação "por você"
  // obsoleta (debug F2-IMP-009 r1 — mesma família do debug da F2-IMP-007 r1).
  const myUserId = pb.authStore.isValid ? pb.authStore.record?.id || '' : ''

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
          reason: 'assunção pela fila única',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      await load()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível assumir o caso.')
    } finally {
      setAssuming('')
    }
  }

  // REF-09 — slots ABERTOS com vaga (leitura pública, mesma do Agendar RN-2.01).
  const loadRescheduleSlots = async () => {
    setRescheduleLoading(true)
    setRescheduleError('')
    try {
      const slots = await pb.collection<RescheduleSlotBase>('agenda_slots').getFullList({
        filter: "status='ABERTO'",
        sort: 'slot_datetime',
      })
      const occ = await pb.collection<OccupancyRow>('agenda_slot_occupancy').getFullList({})
      const occBySlot = new Map(occ.map((o) => [o.slot_id, o]))
      setRescheduleSlots(
        slots
          .map((s) => {
            const o = occBySlot.get(s.slot_id)
            return {
              slot_id: s.slot_id,
              slot_datetime: s.slot_datetime,
              slot_duration_min: s.slot_duration_min,
              capacity: o?.capacity ?? s.capacity ?? 1,
              active: o?.active ?? 0,
            }
          })
          .filter((s) => s.active < s.capacity),
      )
    } catch (err) {
      console.error(err)
      setRescheduleSlots([])
      setRescheduleError('Falha ao carregar a grade de horários.')
    } finally {
      setRescheduleLoading(false)
    }
  }

  // REF-10 — classificação manual "Sem perfil": UPDATE no MESMO registro (histórico
  // preservado) + evento APPOINTMENT_SEM_PERFIL com actor do operador e payload
  // {motivo, reversao}. Reversível com motivo (insumo 4); a reserva não é alterada
  // (insumo 5 — decidir caso a caso); o status interno não muda (rótulo ≠ estado).
  const classificarSemPerfil = async (appt: Appointment, reversao: boolean) => {
    if (!pb.authStore.isValid) return
    if (!classReason.trim()) {
      setClassError(
        reversao ? 'Informe o motivo da reversão.' : 'Informe o motivo da classificação.',
      )
      return
    }
    const actorId = pb.authStore.record?.id || ''
    setClassifying(appt.id)
    setClassError('')
    try {
      const now = new Date().toISOString()
      const motivo = classReason.trim()
      await pb.collection('lead_appointments').update(appt.id, {
        sem_perfil_at: reversao ? '' : now,
        sem_perfil_motivo: reversao ? '' : motivo,
        sem_perfil_por: reversao ? '' : actorId,
      })
      await pb.collection('lead_appointment_events').create({
        event_id: crypto.randomUUID(),
        appointment_id: appt.appointment_id,
        lead_submission_id: appt.lead_submission_id,
        event_type: 'APPOINTMENT_SEM_PERFIL',
        occurred_at: now,
        actor_id: actorId,
        payload: { motivo, reversao },
      })
      setClassDone(
        reversao
          ? `Classificação "Sem perfil" de ${appt.nome || 'lead'} revertida.`
          : `${appt.nome || 'Lead'} classificado como "Sem perfil".`,
      )
      setClassReason('')
      setClassOpen(false)
      await load()
    } catch (err) {
      console.error(err)
      setClassError(
        err instanceof Error
          ? `Falha ao ${reversao ? 'reverter' : 'classificar'}: ${err.message}`
          : `Falha ao ${reversao ? 'reverter' : 'classificar'} — nada foi alterado.`,
      )
    } finally {
      setClassifying('')
    }
  }

  const confirmarReagendamento = async (appt: Appointment) => {
    if (!pb.authStore.isValid) return
    if (!reschedulePick) {
      setRescheduleError('Escolha um horário antes de confirmar.')
      return
    }
    const slot = rescheduleSlots.find((s) => s.slot_id === reschedulePick)
    if (!slot) {
      setRescheduleError('Horário indisponível. Escolha outro, por favor.')
      return
    }
    const actorId = pb.authStore.record?.id || ''
    setRescheduling(appt.id)
    setRescheduleError('')
    try {
      const now = new Date().toISOString()
      const sameSlot = appt.slot_id === slot.slot_id
      await pb.collection('lead_appointments').update(appt.id, {
        slot_id: slot.slot_id,
        slot_datetime: slot.slot_datetime,
        slot_duration_min: slot.slot_duration_min,
      })
      await pb.collection('lead_appointment_events').create({
        event_id: crypto.randomUUID(),
        appointment_id: appt.appointment_id,
        lead_submission_id: appt.lead_submission_id,
        event_type: 'APPOINTMENT_RESCHEDULED',
        occurred_at: now,
        actor_id: actorId,
        payload: {
          from: { slot_id: appt.slot_id, slot_datetime: appt.slot_datetime },
          to: { slot_id: slot.slot_id, slot_datetime: slot.slot_datetime },
          same_slot: sameSlot,
        },
      })
      setRescheduleDone(
        `Agendamento de ${appt.nome || 'lead'} remarcado para ${formatSlotRotulo(slot.slot_datetime)}.`,
      )
      setDetail(null)
      setReschedulePick('')
      setRescheduleConfirm(false)
      await load()
    } catch (err) {
      console.error(err)
      setRescheduleError(
        err instanceof Error
          ? `Falha ao reagendar: ${err.message}`
          : 'Falha ao reagendar — a reserva anterior foi preservada.',
      )
    } finally {
      setRescheduling('')
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
    filter === 'TODOS'
      ? appointments
      : filter === 'SEM_PERFIL'
        ? appointments.filter((a) => !!a.sem_perfil_at)
        : appointments.filter((a) => a.status === filter)

  const counts = STATUSES.map((s) => ({
    status: s,
    total: appointments.filter((a) => a.status === s).length,
  }))
  // REF-10 — "Sem perfil" é classificação manual (não é status do banco); o filtro
  // conta os registros com sem_perfil_at preenchido, distinto de "Sem interesse".
  const semPerfilTotal = appointments.filter((a) => !!a.sem_perfil_at).length

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
              Em andamento de agendamento com contexto da triagem. Leitura — a conclusão vem da
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
                    {STATUS_LABELS[status] || status} ({total})
                  </button>
                ))}
                <button
                  onClick={() => setFilter('SEM_PERFIL')}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    filter === 'SEM_PERFIL'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  Sem perfil ({semPerfilTotal})
                </button>
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
                      Fila {queueEnabled ? 'habilitada' : 'desabilitada'}
                    </span>
                    <input
                      aria-label="Motivo do rollback/reativação"
                      value={rollbackReason}
                      onChange={(e) => setRollbackReason(e.target.value)}
                      placeholder="Motivo obrigatório"
                      className="min-h-8 w-40 rounded-lg border border-slate-200 px-2 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      disabled={!queueEnabled}
                      onClick={() => rollbackQueue('ROLLBACK')}
                      className="rounded-lg border border-red-200 px-2 py-1 font-bold text-red-700 disabled:opacity-50"
                    >
                      Rollback
                    </button>
                    <button
                      disabled={queueEnabled}
                      onClick={() => rollbackQueue('RESTORE')}
                      className="rounded-lg border border-emerald-200 px-2 py-1 font-bold text-emerald-700 disabled:opacity-50"
                    >
                      Reativar
                    </button>
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
                        {STATUS_LABELS[appt.status] || appt.status}
                      </span>
                      {appt.sem_perfil_at && (
                        <span
                          className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                          title={appt.sem_perfil_motivo || ''}
                        >
                          Sem perfil
                        </span>
                      )}
                      <span
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title={appt.prioridade_motivo || 'sem resposta de rotina'}
                      >
                        {rotuloPrioridade({
                          nota: appt.prioridade_nota ?? 0,
                          faixa: appt.prioridade_faixa ?? 'sem_pontuacao',
                          matriz: '',
                          motivo: '',
                        })}
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
                        {appt.responsavel_anterior && (
                          <p>
                            Reatribuída — responsável anterior:{' '}
                            {appt.responsavel_anterior === myUserId
                              ? 'você'
                              : appt.responsavel_anterior}
                          </p>
                        )}
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
                          value={operationReason}
                          onChange={(e) => setOperationReason(e.target.value)}
                          placeholder="Motivo obrigatório"
                          className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                        <input
                          aria-label="Novo responsável"
                          value={targetOwner}
                          onChange={(e) => setTargetOwner(e.target.value)}
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
                      onClick={() => {
                        // REF-09 — painel de reagendamento começa fechado a cada modal
                        setRescheduleOpen(false)
                        setReschedulePick('')
                        setRescheduleError('')
                        setRescheduleDone('')
                        // REF-10 — painel de classificação começa fechado a cada modal
                        setClassOpen(false)
                        setClassReason('')
                        setClassError('')
                        setClassDone('')
                        setDetail(appt)
                      }}
                      className="mt-4 min-h-10 w-full rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-orange-700 dark:border-slate-700 dark:bg-slate-900 dark:text-orange-300"
                    >
                      Ver detalhes
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
          onClick={() => {
            setRescheduleOpen(false)
            setReschedulePick('')
            setRescheduleError('')
            setRescheduleDone('')
            setClassOpen(false)
            setClassReason('')
            setClassError('')
            setClassDone('')
            setDetail(null)
          }}
        >
          {' '}
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
                {STATUS_LABELS[detail.status] || detail.status}
              </span>
              {detail.sem_perfil_at && (
                <span
                  className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                  title={detail.sem_perfil_motivo || ''}
                >
                  Sem perfil
                </span>
              )}
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

            {(detail.status === 'CONCLUIDO' || detail.status === 'TENTATIVA') && (
              <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-900 dark:bg-orange-950/30">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Reagendar este agendamento
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  A reserva atual é preservada até a confirmação; o histórico fica na trilha de
                  eventos.
                </p>
                {!rescheduleOpen && (
                  <button
                    onClick={() => {
                      setRescheduleOpen(true)
                      loadRescheduleSlots()
                    }}
                    className="mt-3 min-h-10 rounded-xl border border-orange-300 bg-white px-4 text-sm font-bold text-orange-700 dark:bg-slate-900"
                  >
                    Reagendar
                  </button>
                )}
                {rescheduleOpen && (
                  <div className="mt-3 space-y-3">
                    {rescheduleLoading && (
                      <p className="text-sm text-slate-500">Carregando horários…</p>
                    )}
                    {rescheduleError && (
                      <p
                        role="alert"
                        className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300"
                      >
                        {rescheduleError}
                      </p>
                    )}
                    {rescheduleDone && (
                      <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {rescheduleDone}
                      </p>
                    )}
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      {rescheduleSlots.map((s) => (
                        <button
                          key={s.slot_id}
                          onClick={() => {
                            setReschedulePick(s.slot_id)
                            setRescheduleConfirm(false)
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            reschedulePick === s.slot_id
                              ? 'bg-orange-600 font-bold text-white'
                              : 'hover:bg-orange-50 dark:hover:bg-orange-950/40'
                          }`}
                        >
                          <span>{formatSlotRotulo(s.slot_datetime)}</span>
                          <span className="text-xs">{s.capacity - s.active} vagas</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={!reschedulePick || rescheduling === detail.id}
                        onClick={() => confirmarReagendamento(detail)}
                        className="min-h-10 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {rescheduling === detail.id ? 'Reagendando…' : 'Confirmar reagendamento'}
                      </button>
                      <button
                        onClick={() => {
                          setRescheduleOpen(false)
                          setReschedulePick('')
                          setRescheduleConfirm(false)
                        }}
                        className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* REF-10 — classificação "Sem perfil": manual, motivo obrigatório,
                reversível com motivo; a reserva não é alterada (insumos 1–5). */}
            <div className="mt-6 rounded-2xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-900 dark:bg-purple-950/30">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Classificação &quot;Sem perfil&quot;
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Distinta de &quot;Sem interesse&quot;. A reserva não é alterada; o histórico fica na
                trilha de eventos.
              </p>
              {classError && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300"
                >
                  {classError}
                </p>
              )}
              {classDone && (
                <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {classDone}
                </p>
              )}
              {detail.sem_perfil_at ? (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Classificado em {formatDate(detail.sem_perfil_at)}
                    {detail.sem_perfil_motivo ? ` · motivo: ${detail.sem_perfil_motivo}` : ''}
                  </p>
                  <input
                    aria-label="Motivo da reversão"
                    value={classReason}
                    onChange={(e) => setClassReason(e.target.value)}
                    placeholder="Motivo obrigatório da reversão"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={classifying === detail.id}
                      onClick={() => classificarSemPerfil(detail, true)}
                      className="min-h-10 rounded-xl border border-purple-300 bg-white px-4 text-sm font-bold text-purple-700 disabled:opacity-50 dark:bg-slate-900"
                    >
                      {classifying === detail.id ? 'Revertendo…' : 'Reverter classificação'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {!classOpen ? (
                    <button
                      onClick={() => {
                        setClassOpen(true)
                        setClassReason('')
                        setClassError('')
                      }}
                      className="min-h-10 rounded-xl border border-purple-300 bg-white px-4 text-sm font-bold text-purple-700 dark:bg-slate-900"
                    >
                      Classificar como Sem perfil
                    </button>
                  ) : (
                    <>
                      <input
                        aria-label="Motivo da classificação"
                        value={classReason}
                        onChange={(e) => setClassReason(e.target.value)}
                        placeholder="Motivo obrigatório"
                        className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={classifying === detail.id || !classReason.trim()}
                          onClick={() => classificarSemPerfil(detail, false)}
                          className="min-h-10 rounded-xl bg-purple-700 px-4 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {classifying === detail.id ? 'Classificando…' : 'Confirmar classificação'}
                        </button>
                        <button
                          onClick={() => {
                            setClassOpen(false)
                            setClassReason('')
                            setClassError('')
                          }}
                          className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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
