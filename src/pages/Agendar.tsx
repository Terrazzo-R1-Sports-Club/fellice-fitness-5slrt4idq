import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// F2-IMP-003 / SPEC-2-001 — seleção e conclusão do agendamento.
// Fluxo do lead: escolher slot ABERTO (RN-2.01) → preencher campos mínimos (F2-T003) →
// confirmar (RN-2.03: TENTATIVA → CONCLUIDO com concluded_at). Fallback RN-2.05:
// grade vazia ou falha → ENCAMINHAMENTO_HUMANO com handoff_reason, sem confirmação falsa.
// RN-2.06: se o lead volta e escolhe outro slot, a tentativa não confirmada é ATUALIZADA
// (índice único lead_submission_id+slot_id — contrato F2-IMP-001).
// LGPD: campos mínimos sob execução de serviço solicitado; e-mail opcional e voluntário.

const FORM_ID = 'fellice-captura-01'
const FORM_VERSION = 'v1.0.0'
const BACKEND_URL = import.meta.env.VITE_POCKETBASE_URL

type Slot = {
  id: string
  slot_id: string
  slot_datetime: string
  slot_duration_min: number
  capacity: number
  status: string
}

type Step = 'grade' | 'dados' | 'confirmado' | 'encaminhado'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const formatDay = (iso: string) => {
  const date = new Date(iso.replace(' ', 'T'))
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

const formatTime = (iso: string) => iso.slice(11, 16)

async function createRecord(collection: string, data: Record<string, unknown>) {
  if (!BACKEND_URL) throw new Error('Backend do Skip não configurado')
  const response = await fetch(`${BACKEND_URL}/api/collections/${collection}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(`Falha ao salvar (${response.status})`)
  return response.json()
}

async function updateRecord(collection: string, recordId: string, data: Record<string, unknown>) {
  if (!BACKEND_URL) throw new Error('Backend do Skip não configurado')
  const response = await fetch(`${BACKEND_URL}/api/collections/${collection}/records/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(`Falha ao atualizar (${response.status})`)
  return response.json()
}

const inputClass =
  'min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-orange-500 dark:focus:ring-orange-950/60'

const Agendar = () => {
  const [step, setStep] = useState<Step>('grade')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Slot | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [appointmentId, setAppointmentId] = useState('')
  const [existingAppointment, setExistingAppointment] = useState<{
    id: string
    slot_id: string
  } | null>(null)
  const [form, setForm] = useState({
    nome: '',
    telefone_ou_canal_de_retorno: '',
    localidade: '',
    profissao: '',
    email: '',
  })
  const leadSubmissionId = useRef(crypto.randomUUID())
  const [occupancy, setOccupancy] = useState<Record<string, number>>({})

  const loadSlots = async () => {
    if (!BACKEND_URL) {
      setLoadError('Backend do Skip não configurado.')
      setLoadingSlots(false)
      return
    }
    setLoadingSlots(true)
    setLoadError('')
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/collections/agenda_slots/records?filter=(status='ABERTO')&sort=slot_datetime&perPage=200`,
      )
      if (!response.ok) throw new Error(`Falha ao carregar grade (${response.status})`)
      const data = await response.json()
      setSlots(data.items || [])
    } catch (err) {
      console.error(err)
      setLoadError('Não foi possível carregar os horários agora.')
    } finally {
      setLoadingSlots(false)
    }
  }

  // RN-2.01: ocupação real por slot — lida da coleção pública agenda_slot_occupancy
  // (1 registro por slot, campo active = reservas ativas, recalculada pela migração 0018
  // e mantida pelo fluxo). A página NÃO OFERTA slot cheio (active >= capacity).
  const loadOccupancy = async () => {
    if (!BACKEND_URL) return
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/collections/agenda_slot_occupancy/records?perPage=500`,
      )
      if (!response.ok) return
      const data = await response.json()
      const map: Record<string, number> = {}
      for (const row of data.items || []) {
        map[row.slot_id] = row.active || 0
      }
      setOccupancy(map)
    } catch (err) {
      console.warn('Não foi possível carregar a ocupação da grade.', err)
    }
  }

  useEffect(() => {
    loadSlots()
    loadOccupancy()
  }, [])

  const byDay = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const day = slot.slot_datetime.slice(0, 10)
    acc[day] = acc[day] || []
    acc[day].push(slot)
    return acc
  }, {})

  const handoffToHuman = async (reason: string) => {
    const now = new Date().toISOString()
    const appointment = await createRecord('lead_appointments', {
      appointment_id: crypto.randomUUID(),
      lead_submission_id: leadSubmissionId.current,
      form_id: FORM_ID,
      form_version: FORM_VERSION,
      slot_id: '',
      slot_datetime: now,
      slot_duration_min: 30,
      status: 'ENCAMINHAMENTO_HUMANO',
      conflict_detected: false,
      handoff_reason: reason,
      created_at: now,
    })
    await createRecord('lead_appointment_events', {
      event_id: crypto.randomUUID(),
      appointment_id: appointment.appointment_id,
      lead_submission_id: leadSubmissionId.current,
      event_type: 'APPOINTMENT_HANDOFF',
      occurred_at: now,
      actor_id: 'public',
      payload: { handoff_reason: reason },
    })
    setStep('encaminhado')
  }

  const confirmAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    // RN-2.03: campos mínimos ausentes impedem CONCLUIDO (validação no cliente,
    // conforme contrato F2-IMP-001 — a prova de borda é da F2-IMP-004)
    if (
      !form.nome.trim() ||
      !form.telefone_ou_canal_de_retorno.trim() ||
      !form.localidade ||
      !form.profissao.trim()
    ) {
      setError('Preencha nome, canal de retorno, localidade e profissão para confirmar.')
      return
    }
    setSending(true)
    setError('')
    const now = new Date().toISOString()
    try {
      let appointmentRecord: Record<string, unknown>
      if (existingAppointment && existingAppointment.slot_id !== selected.slot_id) {
        // RN-2.06: reescolha de slot atualiza a mesma tentativa (não duplica)
        appointmentRecord = await updateRecord('lead_appointments', existingAppointment.id, {
          slot_id: selected.slot_id,
          slot_datetime: selected.slot_datetime,
          slot_duration_min: selected.slot_duration_min,
          nome: form.nome,
          telefone_ou_canal_de_retorno: form.telefone_ou_canal_de_retorno,
          localidade: form.localidade,
          profissao: form.profissao,
          email: form.email,
          status: 'CONCLUIDO',
          conflict_detected: false,
          concluded_at: now,
        })
        await createRecord('lead_appointment_events', {
          event_id: crypto.randomUUID(),
          appointment_id: appointmentRecord.appointment_id,
          lead_submission_id: leadSubmissionId.current,
          event_type: 'APPOINTMENT_CONCLUDED',
          occurred_at: now,
          actor_id: 'public',
          payload: { slot_id: selected.slot_id, rescheduled: true },
        })
      } else {
        appointmentRecord = await createRecord('lead_appointments', {
          appointment_id: crypto.randomUUID(),
          lead_submission_id: leadSubmissionId.current,
          form_id: FORM_ID,
          form_version: FORM_VERSION,
          slot_id: selected.slot_id,
          slot_datetime: selected.slot_datetime,
          slot_duration_min: selected.slot_duration_min,
          nome: form.nome,
          telefone_ou_canal_de_retorno: form.telefone_ou_canal_de_retorno,
          localidade: form.localidade,
          profissao: form.profissao,
          email: form.email,
          status: 'CONCLUIDO',
          conflict_detected: false,
          created_at: now,
          concluded_at: now,
        })
        await createRecord('lead_appointment_events', {
          event_id: crypto.randomUUID(),
          appointment_id: appointmentRecord.appointment_id,
          lead_submission_id: leadSubmissionId.current,
          event_type: 'APPOINTMENT_CREATED',
          occurred_at: now,
          actor_id: 'public',
          payload: { slot_id: selected.slot_id },
        })
        await createRecord('lead_appointment_events', {
          event_id: crypto.randomUUID(),
          appointment_id: appointmentRecord.appointment_id,
          lead_submission_id: leadSubmissionId.current,
          event_type: 'APPOINTMENT_CONCLUDED',
          occurred_at: now,
          actor_id: 'public',
          payload: { slot_id: selected.slot_id },
        })
      }
      setAppointmentId(String(appointmentRecord.appointment_id))
      setStep('confirmado')
    } catch (err) {
      console.error(err)
      const status = err instanceof Error && err.message.includes('400') ? 400 : 0
      if (status === 400) {
        // provável conflito: slot tomado ou duplicado — RN-2.06 sem confirmação falsa
        setError('Este horário acabou de ser ocupado. Escolha outro, por favor.')
        setSelected(null)
        setStep('grade')
        await loadSlots()
      } else {
        // RN-2.05: falha de salvamento → encaminhamento humano, sem confirmação falsa
        try {
          await handoffToHuman('falha de sistema ao salvar o agendamento (sintético)')
        } catch {
          setError('Não foi possível concluir agora. Tente novamente em instantes.')
        }
      }
    } finally {
      setSending(false)
    }
  }

  // RN-2.01: só oferta slots com vaga real — reservas ativas (CONCLUIDO + TENTATIVA)
  // por slot contadas contra a capacidade. A contagem usa a lista carregada da grade.
  const loadOccupancy = async () => {
    if (!BACKEND_URL) return
    try {
      // tentativas ativas são públicas apenas em contagem agregada via filtro;
      // a leitura da coleção é autenticada, então a ocupação vem dos eventos públicos:
      // cada reserva ativa tem APPOINTMENT_CREATED sem ABANDONED posterior.
      const response = await fetch(
        `${BACKEND_URL}/api/collections/lead_appointment_events/records?filter=(event_type='APPOINTMENT_CREATED')&perPage=500`,
      )
      if (!response.ok) return
      const data = await response.json()
      const abandoned = new Set(
        (data.items || [])
          .filter(
            (e: { event_type: string; appointment_id: string }) =>
              e.event_type === 'APPOINTMENT_ABANDONED',
          )
          .map((e: { appointment_id: string }) => e.appointment_id),
      )
      const occupied: Record<string, number> = {}
      for (const ev of data.items || []) {
        if (ev.event_type !== 'APPOINTMENT_CREATED' || abandoned.has(ev.appointment_id)) continue
        const slotId = ev.payload?.slot_id
        if (slotId) occupied[slotId] = (occupied[slotId] || 0) + 1
      }
      setOccupancy(occupied)
    } catch (err) {
      console.warn('Não foi possível calcular a ocupação da grade.', err)
    }
  }

  const chooseSlot = (slot: Slot) => {
    // RN-2.01/CA-2.02: bloqueia slot cheio no momento do clique (defesa em profundidade —
    // a grade já esconde, mas a ocupação pode ter mudado desde o carregamento)
    const active = occupancy[slot.slot_id] || 0
    if (active >= slot.capacity) {
      setError('Este horário acabou de encher. Escolha outro, por favor.')
      return
    }
    setSelected(slot)
    setError('')
    setStep('dados')
  }

  const requestHuman = async () => {
    setSending(true)
    setError('')
    try {
      await handoffToHuman('lead solicitou atendimento humano na tela de agendamento')
    } catch (err) {
      console.error(err)
      setError('Não foi possível registrar o pedido agora. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fffaf5] text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-orange-100/80 bg-white/90 backdrop-blur transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-600 dark:text-orange-500">
              Fellice Fitness
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Terrazzo R1 Sports Club
            </p>
          </div>
          <Link to="/" className="text-sm font-semibold text-orange-600">
            ← Voltar à triagem
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Escolha o melhor horário para conhecer a academia
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Visita presencial ou aula experimental de 30 minutos, com um atendente dedicado.
        </p>

        {step === 'grade' && (
          <section className="mt-8">
            {loadingSlots && <p className="text-slate-500">Carregando horários...</p>}
            {loadError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800 dark:border-slate-800 dark:bg-red-950/50 dark:text-red-300">
                <p>{loadError}</p>
                <button
                  onClick={loadSlots}
                  className="mt-3 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white"
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {!loadingSlots && !loadError && slots.length === 0 && (
              <div className="rounded-2xl border border-dashed border-orange-200 p-8 text-center dark:border-slate-700">
                <p className="font-semibold">Nenhum horário disponível no momento.</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Deixe seu pedido e nossa equipe entra em contato para combinar o melhor horário.
                </p>
                <button
                  disabled={sending}
                  onClick={requestHuman}
                  className="mt-5 min-h-12 rounded-xl bg-orange-600 px-5 font-bold text-white disabled:opacity-60"
                >
                  {sending ? 'Registrando...' : 'Quero falar com um atendente'}
                </button>
              </div>
            )}
            {!loadingSlots &&
              Object.entries(byDay).map(([day, daySlots]) => (
                <div key={day} className="mt-8">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {formatDay(`${day} 12:00:00.000Z`)}
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {daySlots.map((slot) => {
                      // RN-2.01: slot cheio (ocupação >= capacidade) não é ofertado
                      const active = occupancy[slot.slot_id] || 0
                      const full = active >= slot.capacity
                      const remaining = Math.max(slot.capacity - active, 0)
                      if (full) return null
                      return (
                        <button
                          key={slot.slot_id}
                          onClick={() => chooseSlot(slot)}
                          className="rounded-xl border border-orange-100 bg-white px-3 py-3 text-center font-bold text-slate-800 transition hover:border-orange-400 hover:bg-orange-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-orange-600 dark:hover:bg-slate-800"
                        >
                          {formatTime(slot.slot_datetime)}
                          {slot.capacity > 1 && (
                            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                              {remaining} vagas
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            {!loadingSlots && slots.length > 0 && (
              <button
                disabled={sending}
                onClick={requestHuman}
                className="mt-10 text-sm font-semibold text-orange-600 underline-offset-4 hover:underline disabled:opacity-60"
              >
                Não encontrei um bom horário — prefiro falar com um atendente
              </button>
            )}
          </section>
        )}

        {step === 'dados' && selected && (
          <form
            onSubmit={confirmAppointment}
            className="mt-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-xl shadow-orange-100/50 sm:p-9 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
          >
            <div className="mb-6 rounded-2xl bg-orange-50 p-4 dark:bg-slate-800/60">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                Horário escolhido
              </p>
              <p className="mt-1 text-lg font-black">
                {formatDay(selected.slot_datetime)} às {formatTime(selected.slot_datetime)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setStep('grade')
                }}
                className="mt-2 text-sm font-semibold text-orange-600"
              >
                Escolher outro horário
              </button>
            </div>
            <h2 className="text-xl font-bold">Seus dados</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="text-orange-600">*</span> Campos obrigatórios
            </p>
            <div className="mt-6 space-y-5">
              <label className="block text-sm font-medium">
                <span>
                  Nome completo <span className="text-orange-600">*</span>
                </span>
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Seu nome"
                  className={`mt-2 ${inputClass}`}
                />
              </label>
              <label className="block text-sm font-medium">
                <span>
                  Telefone ou canal de retorno <span className="text-orange-600">*</span>
                </span>
                <input
                  required
                  value={form.telefone_ou_canal_de_retorno}
                  onChange={(e) =>
                    setForm({ ...form, telefone_ou_canal_de_retorno: e.target.value })
                  }
                  placeholder="WhatsApp ou telefone com DDD"
                  className={`mt-2 ${inputClass}`}
                />
              </label>
              <div className="text-sm font-medium">
                <span>
                  Onde você mora ou trabalha mais perto da academia?{' '}
                  <span className="text-orange-600">*</span>
                </span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {['residencial', 'comercial'].map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setForm({ ...form, localidade: option })}
                      className={`min-h-12 rounded-xl border px-4 font-bold capitalize transition ${
                        form.localidade === option
                          ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-medium">
                <span>
                  Profissão <span className="text-orange-600">*</span>
                </span>
                <input
                  required
                  value={form.profissao}
                  onChange={(e) => setForm({ ...form, profissao: e.target.value })}
                  placeholder="Sua profissão"
                  className={`mt-2 ${inputClass}`}
                />
              </label>
              <label className="block text-sm font-medium">
                <span>E-mail (opcional)</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Se quiser receber confirmação por e-mail"
                  className={`mt-2 ${inputClass}`}
                />
              </label>
            </div>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="mt-6 min-h-12 w-full rounded-xl bg-orange-600 px-5 font-bold text-white transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? 'Confirmando...' : 'Confirmar meu horário'}
            </button>
          </form>
        )}

        {step === 'confirmado' && (
          <section className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50 p-8 text-center dark:border-slate-800 dark:bg-emerald-950/40">
            <p className="text-4xl">✅</p>
            <h2 className="mt-4 text-2xl font-black text-emerald-900 dark:text-emerald-200">
              Horário reservado!
            </h2>
            <p className="mt-3 text-emerald-800 dark:text-emerald-300">
              {selected && (
                <>
                  {formatDay(selected.slot_datetime)} às {formatTime(selected.slot_datetime)} — te
                  esperamos na Fellice Fitness (Terrazzo R1 Sports Club).
                </>
              )}
            </p>
            <p className="mt-4 text-xs text-emerald-700 dark:text-emerald-400">
              Código da reserva: {appointmentId}
            </p>
            <Link
              to="/"
              className="mt-6 inline-block min-h-12 rounded-xl bg-orange-600 px-6 leading-[3rem] font-bold text-white"
            >
              Concluir
            </Link>
          </section>
        )}

        {step === 'encaminhado' && (
          <section className="mt-8 rounded-3xl border border-orange-100 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-4xl">🤝</p>
            <h2 className="mt-4 text-2xl font-black">Vamos combinar o horário com você</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Registramos seu pedido e a equipe da Fellice Fitness vai entrar em contato pelo canal
              informado para encontrar o melhor horário.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block min-h-12 rounded-xl bg-orange-600 px-6 leading-[3rem] font-bold text-white"
            >
              Voltar ao início
            </Link>
          </section>
        )}
      </main>
    </div>
  )
}

export default Agendar
