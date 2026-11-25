import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'

// F2-IMP-005 / SPEC-2-001 — página de agendamento (grade pública de horários).
// REF-02: pré-preenche "Seus dados" com as respostas da triagem (estado do
// roteador) e REUSA o mesmo lead_submission_id (contrato B3-03 — sem lead
// duplicado). REF-04: endereço aprovado no header e na confirmação; sem oferta
// duplicada de freepass. REF-06: acesso direto sem triagem → encaminhamento
// humano (ACESSO_DIRETO_SEM_TRIAGEM), com erro do encaminhamento visível na
// grade (caminho de erro não silencioso — debug REF-06).

const BACKEND_URL = import.meta.env.VITE_POCKETBASE_URL

const WHATSAPP_ATENDIMENTO = '5571993960018'

const ENDERECO = 'Rua Rubens Guelli, 68 - Terraço - Itaigara, Salvador - BA, 41815-135'

type Slot = {
  slot_id: string
  slot_datetime: string
  slot_duration_min: number
  capacity: number
  active: number
}

export interface AgendarState {
  lead_submission_id: string
  nome: string
  telefone: string
  email: string
  proximidade: string
  ocupacao: string
  profissao: string
  prioridade?: {
    nota: number
    faixa: 'alta' | 'media' | 'baixa' | 'sem_pontuacao'
    matriz: string
    motivo: string
  }
}

const localidadeDaProximidade = (proximidade: string): 'residencial' | 'comercial' =>
  proximidade === 'Trabalho na região do Itaigara' ? 'comercial' : 'residencial'

// REF-09 r2 — o horário é exibido como gravado (string crua, sem conversão de
// fuso): a grade é criada em UTC com o horário local de Salvador já embutido.
const formatSlotDia = (iso: string) => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}
const formatSlotHora = (iso: string) => iso.slice(11, 16)
const formatSlotRotulo = (iso: string) => `${formatSlotDia(iso)} ${formatSlotHora(iso)}`

const Agendar = () => {
  const navigate = useNavigate()
  const state = (useLocation().state as AgendarState | null) || null
  const submissionId = state?.lead_submission_id || ''

  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState<Slot | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [confirmado, setConfirmado] = useState<{ appointment_id: string; slot: Slot } | null>(null)
  const [encaminhado, setEncaminhado] = useState(false)

  // "Seus dados" — pré-preenchidos pela triagem (REF-02); editáveis antes de confirmar.
  const [nome, setNome] = useState(state?.nome || '')
  const [telefone, setTelefone] = useState(state?.telefone || '')
  const [email, setEmail] = useState(state?.email || '')
  const [profissao, setProfissao] = useState(state?.profissao || '')
  const [localidade, setLocalidade] = useState<'residencial' | 'comercial'>(
    state?.proximidade ? localidadeDaProximidade(state.proximidade) : 'residencial',
  )

  const loadSlots = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await pb.collection<Slot>('agenda_slots').getFullList({
        filter: "status='ABERTO'",
        sort: 'slot_datetime',
      })
      const occ = await pb
        .collection<{ slot_id: string; capacity: number; active: number }>(
          'agenda_slot_occupancy',
        )
        .getFullList({})
      const occBySlot = new Map(occ.map((o) => [o.slot_id, o]))
      setSlots(
        result
          .map((s) => {
            const o = occBySlot.get(s.slot_id)
            return { ...s, capacity: o?.capacity ?? s.capacity ?? 1, active: o?.active ?? 0 }
          })
          .filter((s) => s.active < s.capacity),
      )
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar a grade de horários. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSlots()
  }, [])

  const reservar = async () => {
    if (!selecionado || enviando) return
    setEnviando(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const appointmentId = crypto.randomUUID()
      await pb.collection('lead_appointments').create({
        appointment_id: appointmentId,
        lead_submission_id: submissionId,
        form_id: 'fellice-captura-01',
        form_version: 'v1.2.1',
        slot_id: selecionado.slot_id,
        slot_datetime: selecionado.slot_datetime,
        slot_duration_min: selecionado.slot_duration_min,
        nome: nome.trim(),
        telefone_ou_canal_de_retorno: `${telefone.trim()} | ${email.trim()}`,
        email: email.trim(),
        localidade,
        profissao: profissao.trim(),
        status: 'CONCLUIDO',
        concluded_at: now,
        conflict_detected: false,
      })
      await pb.collection('lead_appointment_events').create({
        event_id: crypto.randomUUID(),
        appointment_id: appointmentId,
        lead_submission_id: submissionId,
        event_type: 'APPOINTMENT_CREATED',
        occurred_at: now,
        payload: { slot_id: selecionado.slot_id },
      })
      await pb.collection('lead_appointment_events').create({
        event_id: crypto.randomUUID(),
        appointment_id: appointmentId,
        lead_submission_id: submissionId,
        event_type: 'APPOINTMENT_CONCLUDED',
        occurred_at: now,
        payload: { slot_id: selecionado.slot_id },
      })
      setConfirmado({ appointment_id: appointmentId, slot: selecionado })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error && err.message.includes('encher')
          ? err.message
          : 'Não foi possível confirmar a reserva. Escolha outro horário, por favor.',
      )
      await loadSlots()
    } finally {
      setEnviando(false)
    }
  }

  // REF-06 — acesso direto a /agendar sem triagem: encaminhamento humano
  // (ACESSO_DIRETO_SEM_TRIAGEM), sem grade; erro visível se o handoff falhar.
  const encaminharSemTriagem = async () => {
    setEnviando(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const handoffId = crypto.randomUUID()
      await pb.collection('lead_handoffs').create({
        handoff_id: handoffId,
        lead_submission_id: '',
        form_id: 'fellice-captura-01',
        form_version: 'v1.2.1',
        created_at: now,
        motivo: 'ACESSO_DIRETO_SEM_TRIAGEM',
        nome: nome.trim() || 'Lead (acesso direto)',
        canal_de_retorno: `${telefone.trim()} | ${email.trim()}`,
        objetivo: '',
        proximidade: '',
        interesse_em_visita: '',
        attribution_status: 'ausente',
        status: 'PENDENTE',
      })
      await pb.collection('lead_handoff_events').create({
        event_id: crypto.randomUUID(),
        handoff_id: handoffId,
        lead_submission_id: '',
        event_type: 'HANDOFF_CREATED',
        occurred_at: now,
        payload: { status: 'PENDENTE', motivo: 'ACESSO_DIRETO_SEM_TRIAGEM' },
      })
      setEncaminhado(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error(err)
      setError('Não foi possível registrar o encaminhamento. Tente novamente ou fale com a gente pelo WhatsApp (71) 99396-0018.')
    } finally {
      setEnviando(false)
    }
  }

  const irParaGrade = () => {
    navigate('/agendar', {
      state: {
        lead_submission_id: submissionId,
        nome,
        telefone,
        email,
        proximidade: state?.proximidade || '',
        ocupacao: state?.ocupacao || '',
        profissao,
      },
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur transition-colors duration-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-sm">
              R1
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
                Fellice Fitness
              </p>
              <p className="text-sm font-medium text-muted-foreground">{ENDERECO}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {encaminhado ? (
          <div className="rounded-3xl border border-orange-200 bg-card p-6 shadow-2xl transition-all duration-300 sm:p-10">
            <div className="text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <MessageCircle className="h-10 w-10" />
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                Vamos combinar o horário com você
              </h1>
              <p className="mt-3 text-lg font-medium text-foreground">
                Nosso atendimento vai entrar em contato pelo canal informado para encontrar o
                melhor dia e horário no rooftop.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Prefere falar agora? Chame a gente no WhatsApp (71) 99396-0018.
              </p>
            </div>
            <div className="mt-8 text-center">
              <Button asChild size="lg" className="min-h-12 bg-emerald-600 font-bold text-white hover:bg-emerald-700">
                <a href={`https://wa.me/${WHATSAPP_ATENDIMENTO}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Falar no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        ) : confirmado ? (
          <div className="rounded-3xl border border-emerald-500/30 bg-card p-6 shadow-2xl transition-all duration-300 sm:p-10">
            <div className="text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                Reserva confirmada!
              </h1>
              <p className="mt-3 text-lg font-medium text-foreground">
                {formatSlotDia(confirmado.slot.slot_datetime)} às {formatSlotHora(confirmado.slot.slot_datetime)} · {confirmado.slot.slot_duration_min} min
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Código da reserva: <strong className="text-foreground">{confirmado.appointment_id.slice(0, 8)}</strong>
              </p>
              <p className="mt-4 text-sm text-muted-foreground">{ENDERECO}</p>
            </div>
          </div>
        ) : !submissionId ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-elevation sm:p-8">
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                Vamos combinar o horário com você
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Para agendar online, complete a triagem de 2 minutos — ou peça atendimento humano
                e a gente combina tudo com você.
              </p>
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold" htmlFor="ag-nome">Nome</label>
                    <Input id="ag-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 min-h-12" placeholder="Seu nome" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" htmlFor="ag-tel">WhatsApp</label>
                    <Input id="ag-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="mt-1 min-h-12" placeholder="(71) 99999-9999" />
                  </div>
                </div>
                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">{error}</p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="outline" size="lg" className="min-h-12 flex-1">
                    <Link to="/">Fazer a triagem (2 min)</Link>
                  </Button>
                  <Button size="lg" disabled={enviando} onClick={encaminharSemTriagem} className="min-h-12 flex-1 bg-primary font-bold">
                    {enviando ? 'Enviando…' : 'Prefiro atendimento humano'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-elevation sm:p-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Escolha o melhor horário
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                Grade de horários
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Aulas experimentais de 30 minutos no rooftop do Terrazzo R1 Sports Club.
              </p>

              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Seus dados</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold" htmlFor="ag-nome2">Nome</label>
                    <Input id="ag-nome2" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 min-h-12" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" htmlFor="ag-tel2">WhatsApp</label>
                    <Input id="ag-tel2" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="mt-1 min-h-12" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" htmlFor="ag-email">E-mail</label>
                    <Input id="ag-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 min-h-12" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" htmlFor="ag-prof">Profissão</label>
                    <Input id="ag-prof" value={profissao} onChange={(e) => setProfissao(e.target.value)} className="mt-1 min-h-12" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" htmlFor="ag-loc">Unidade</label>
                    <select
                      id="ag-loc"
                      value={localidade}
                      onChange={(e) => setLocalidade(e.target.value as 'residencial' | 'comercial')}
                      className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="residencial">Residencial</option>
                      <option value="comercial">Comercial</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Horários disponíveis</h2>
                {error && (
                  <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">{error}</p>
                )}
                {loading ? (
                  <p className="mt-3 text-sm text-muted-foreground">Carregando horários…</p>
                ) : slots.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nenhum horário disponível no momento.
                  </p>
                ) : (
                  <div className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                    {slots.map((s) => (
                      <button
                        key={s.slot_id}
                        type="button"
                        onClick={() => setSelecionado(s)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          selecionado?.slot_id === s.slot_id
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                            : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <p className="text-sm font-bold">{formatSlotRotulo(s.slot_datetime)}</p>
                        <p className="text-xs text-muted-foreground">{s.capacity - s.active} vaga(s)</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && selecionado && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">{error}</p>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
                <Button variant="outline" onClick={() => navigate('/')} className="min-h-12">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  onClick={reservar}
                  disabled={!selecionado || enviando}
                  className="min-h-12 bg-primary px-8 font-bold"
                >
                  {enviando ? 'Confirmando…' : 'Confirmar reserva'}
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">{ENDERECO}</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default Agendar
