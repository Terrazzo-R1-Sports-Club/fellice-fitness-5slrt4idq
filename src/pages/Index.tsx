import { useState, useRef, useEffect, useId } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  Trophy,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Flame,
  Target,
  MapPin,
  Briefcase,
  CalendarCheck,
  User,
  Phone,
  MessageCircle,
  HelpCircle,
  ShieldCheck,
  Send,
  RotateCcw,
} from 'lucide-react'

export type Submission = {
  nome: string
  telefone: string
  email: string
  canal_de_retorno: string
  proximidade: string
  objetivo: string
  ocupacao: string
  interesse_em_visita: string
  precisa_de_ajuda_humana: boolean
  consentimento: boolean
}

const FORM_ID = 'fellice-captura-01'
const FORM_VERSION = 'v1.0.0'
const BACKEND_URL = import.meta.env.VITE_POCKETBASE_URL
const SDR_WHATSAPP_NUMBER = '5571993960018' // Atendimento Fellice Fitness - Terrazzo R1 Sports Club (Itaigara)

export const objetivos = [
  'Emagrecimento',
  'Ganho de massa muscular',
  'Condicionamento físico e resistência',
  'Saúde, mobilidade e qualidade de vida',
  'Recuperação de lesões',
  'Melhorar a performance esportiva',
  'Ainda não defini meu objetivo',
]

export const proximidades = [
  'Moro no Itaigara ou em bairros vizinhos',
  'Trabalho na região do Itaigara',
  'Passo com frequência pela região',
  'Moro/trabalho em outra região, mas me desloco para treinar',
  'Ainda não conheço bem a região',
]

export const ocupacoes = [
  'CLT',
  'Autônomo/Empresário',
  'Executivo/Gestor',
  'Estudante',
  'Aposentado',
  'Profissional da saúde, educação ou outra área com horário irregular',
  'Prefiro não informar',
]

export const interesses = [
  'Sim, quero agendar uma visita presencial',
  'Sim, quero agendar uma aula experimental',
  'Quero receber mais informações antes de decidir',
  'Não tenho interesse no momento',
]

export const initialForm: Submission = {
  nome: '',
  telefone: '',
  email: '',
  canal_de_retorno: '',
  proximidade: '',
  objetivo: '',
  ocupacao: '',
  interesse_em_visita: '',
  precisa_de_ajuda_humana: false,
  consentimento: true,
}

export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export function isValidPhone(phone: string): boolean {
  let digits = phone.replace(/\D/g, '')
  if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  if (digits.length !== 10 && digits.length !== 11) return false
  const ddd = Number(digits.slice(0, 2))
  return ddd >= 11 && ddd <= 99
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

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

export const TOTAL_STEPS = 7

const motivationalTips = [
  'Você deu o primeiro passo!',
  'Muito bem! Seu plano começa a ganhar forma.',
  'Excelente! Personalização é o segredo do resultado.',
  'Quase lá! Foco na sua meta.',
  'Perfeito! Vamos ajustar tudo para a sua rotina.',
  'Sensacional! O treino perfeito está sendo preparado.',
  'Última etapa! Seu prêmio está te esperando.',
]

const Index = () => {
  const startedAt = useRef(new Date().toISOString())
  const leadSubmissionId = useRef(crypto.randomUUID())
  const startedEventRecorded = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const formId = useId()

  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState<Submission>(initialForm)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [savedLeadName, setSavedLeadName] = useState('')

  useEffect(() => {
    // Foco automático ao mudar de etapa em campos de input
    if (currentStep <= 3) {
      inputRef.current?.focus()
    }
  }, [currentStep])

  const recordStart = async () => {
    if (startedEventRecorded.current || !BACKEND_URL) return
    startedEventRecorded.current = true
    try {
      await createRecord('lead_submission_events', {
        event_id: crypto.randomUUID(),
        lead_submission_id: leadSubmissionId.current,
        event_type: 'FORM_STARTED',
        occurred_at: startedAt.current,
        payload: { form_id: FORM_ID, form_version: FORM_VERSION },
      })
    } catch (error) {
      console.warn('Não foi possível registrar o início da triagem.', error)
    }
  }

  const update = (field: keyof Submission, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (status === 'error') {
      setStatus('idle')
      setErrorMessage('')
    }
  }

  // Validação da etapa atual
  const isCurrentStepValid = (): boolean => {
    switch (currentStep) {
      case 1:
        return form.nome.trim().length >= 2
      case 2:
        return isValidPhone(form.telefone)
      case 3:
        return isValidEmail(form.email)
      case 4:
        return form.objetivo.trim().length > 0
      case 5:
        return form.proximidade.trim().length > 0
      case 6:
        return form.ocupacao.trim().length > 0
      case 7:
        return form.interesse_em_visita.trim().length > 0 && form.consentimento
      default:
        return false
    }
  }

  const handleNext = () => {
    if (!isCurrentStepValid()) return
    recordStart()
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1 && status !== 'sending') {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentStep < TOTAL_STEPS && isCurrentStepValid()) {
      e.preventDefault()
      handleNext()
    }
  }

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault()
    if (!isCurrentStepValid()) return

    setStatus('sending')
    setErrorMessage('')

    const now = new Date().toISOString()
    const submissionStartedAt = startedAt.current
    const params = new URLSearchParams(window.location.search)
    const utmSource = params.get('utm_source') || ''
    const utmMedium = params.get('utm_medium') || ''
    const utmCampaign = params.get('utm_campaign') || ''
    const attributionStatus =
      utmSource && utmMedium && utmCampaign
        ? 'recebida'
        : utmSource || utmMedium || utmCampaign
          ? 'incompleta'
          : 'ausente'

    // Formata o canal de retorno composto (WhatsApp prioritário com e-mail auxiliar)
    const phoneClean = form.telefone.trim()
    const emailClean = form.email.trim()
    const canalDeRetorno = phoneClean
      ? emailClean
        ? `${phoneClean} • ${emailClean}`
        : phoneClean
      : emailClean

    try {
      await createRecord('lead_submissions', {
        lead_submission_id: leadSubmissionId.current,
        form_id: FORM_ID,
        form_version: FORM_VERSION,
        started_at: submissionStartedAt,
        submitted_at: now,
        nome: form.nome.trim(),
        canal_de_retorno: canalDeRetorno,
        objetivo: form.objetivo,
        proximidade: form.proximidade,
        ocupacao: form.ocupacao || 'Prefiro não informar',
        interesse_em_visita: form.interesse_em_visita,
        precisa_de_ajuda_humana: form.precisa_de_ajuda_humana,
        consentimento: form.consentimento,
        consentimento_at: now,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        attribution_status: attributionStatus,
        triagem_status: 'TRIAGEM_CONCLUIDA',
      })

      await createRecord('lead_submission_events', {
        event_id: crypto.randomUUID(),
        lead_submission_id: leadSubmissionId.current,
        event_type: 'TRIAGEM_CONCLUIDA',
        occurred_at: now,
        payload: {
          form_id: FORM_ID,
          form_version: FORM_VERSION,
          gamified_flow: true,
          reward: 'AULA_EXPERIMENTAL',
        },
      })

      if (form.precisa_de_ajuda_humana) {
        const handoffId = crypto.randomUUID()
        await createRecord('lead_handoffs', {
          handoff_id: handoffId,
          lead_submission_id: leadSubmissionId.current,
          form_id: FORM_ID,
          form_version: FORM_VERSION,
          created_at: now,
          motivo: 'PEDIDO_DE_AJUDA_HUMANA',
          nome: form.nome.trim(),
          canal_de_retorno: canalDeRetorno,
          objetivo: form.objetivo,
          proximidade: form.proximidade,
          ocupacao: form.ocupacao || 'Prefiro não informar',
          interesse_em_visita: form.interesse_em_visita,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          attribution_status: attributionStatus,
          status: 'PENDENTE',
        })
        await createRecord('lead_handoff_events', {
          event_id: crypto.randomUUID(),
          handoff_id: handoffId,
          lead_submission_id: leadSubmissionId.current,
          event_type: 'HANDOFF_CREATED',
          occurred_at: now,
          payload: { status: 'PENDENTE', motivo: 'PEDIDO_DE_AJUDA_HUMANA' },
        })
      }

      setSavedLeadName(form.nome.trim())
      setStatus('success')
    } catch (error) {
      console.error(error)
      setStatus('error')
      setErrorMessage('Não foi possível concluir agora. Verifique sua conexão e tente novamente.')
    }
  }

  const restartFlow = () => {
    setForm(initialForm)
    setCurrentStep(1)
    setStatus('idle')
    setErrorMessage('')
    setSavedLeadName('')
    startedAt.current = new Date().toISOString()
    leadSubmissionId.current = crypto.randomUUID()
    startedEventRecorded.current = false
  }

  const buildWhatsAppLink = () => {
    const firstName = savedLeadName.split(' ')[0] || 'Atendente'
    const text = `Olá! Meu nome é ${savedLeadName}. Acabei de responder o formulário e ganhei o prêmio da AULA EXPERIMENTAL na Fellice Fitness (Terrazzo R1 Sports Club)! Gostaria de agendar meu treino.`
    return `https://wa.me/${SDR_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
  }

  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100)
  const isValid = isCurrentStepValid()

  return (
    <div className="min-h-screen bg-[#fffaf5] text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-orange-100/80 bg-white/90 backdrop-blur sticky top-0 z-30 transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white font-black text-lg shadow-md shadow-orange-500/30">
              R1
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-600 dark:text-orange-500">
                Fellice Fitness
              </p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Terrazzo R1 Sports Club • Itaigara
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/agendar"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 transition px-3 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-slate-800"
            >
              <CalendarCheck className="h-4 w-4" />
              Agendar direto
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* Barra de Progresso Gamificada */}
        {status !== 'success' && (
          <div className="w-full bg-orange-100/60 dark:bg-slate-800">
            <div
              className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex-1 w-full max-w-2xl px-5 py-6 sm:py-10 flex flex-col justify-center">
        {status === 'success' ? (
          /* ================= TELA FINAL DE PRÊMIO ================= */
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="relative overflow-hidden rounded-3xl border-2 border-orange-200 bg-gradient-to-b from-white via-orange-50/40 to-white p-6 sm:p-10 text-center shadow-2xl shadow-orange-200/50 dark:border-orange-500/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900 dark:shadow-none">
              {/* Badge de Conquista */}
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Triagem concluída com sucesso!
              </div>

              {/* Ícone de Troféu */}
              <div className="mt-6 flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-orange-400 to-amber-300 opacity-60 blur-lg animate-pulse" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-xl shadow-orange-500/40">
                    <Trophy className="h-12 w-12 stroke-[2.2]" />
                  </div>
                </div>
              </div>

              <h1 className="mt-6 text-2xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                Parabéns, {savedLeadName.split(' ')[0] || 'atleta'}!
              </h1>
              <p className="mt-2 text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400">
                Você desbloqueou seu prêmio exclusivo!
              </p>

              {/* Card do Prêmio */}
              <div className="mt-6 rounded-2xl border-2 border-dashed border-orange-300 bg-white p-5 sm:p-6 text-left shadow-sm dark:border-orange-500/40 dark:bg-slate-950/80">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/60 px-2.5 py-0.5 rounded-full">
                      Seu Prêmio
                    </span>
                    <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                      1 AULA EXPERIMENTAL GRATUITA
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      Válida para musculação, bike indoor, fit dance ou ginástica no rooftop do
                      Terrazzo R1 Sports Club (Itaigara).
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">
                Fale agora direto com nosso SDR / atendente no WhatsApp para confirmar o seu horário
                e resgatar o seu prêmio.
              </p>

              {/* Botão de Resgate no WhatsApp */}
              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={buildWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 text-base sm:text-lg font-black text-white shadow-xl shadow-emerald-600/30 transition-all duration-200 hover:bg-emerald-500 hover:shadow-emerald-600/50 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" />
                  <span>Resgatar Aula no WhatsApp</span>
                </a>

                <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Atendimento rápido via WhatsApp oficial da Fellice Fitness</span>
                </div>
              </div>

              {/* Opções secundárias */}
              <div className="mt-8 border-t border-slate-200 pt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <Link
                  to="/agendar"
                  className="font-semibold text-orange-600 hover:underline dark:text-orange-400"
                >
                  Prefere ver a grade de horários disponíveis?
                </Link>
                <button
                  type="button"
                  onClick={restartFlow}
                  className="inline-flex items-center gap-1 font-medium hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Preencher novamente
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ================= FLUXO GAMIFICADO - UMA PERGUNTA POR VEZ ================= */
          <div className="space-y-6">
            {/* Header da Etapa */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-700 dark:bg-orange-950/80 dark:text-orange-300">
                <Flame className="h-3.5 w-3.5 fill-orange-600 text-orange-600 dark:fill-orange-400 dark:text-orange-400" />
                <span>
                  Fase {currentStep} de {TOTAL_STEPS}
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {progressPercent}% completo
              </span>
            </div>

            {/* Card Principal da Pergunta */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (currentStep === TOTAL_STEPS) {
                  handleSubmit(e)
                } else {
                  handleNext()
                }
              }}
              onKeyDown={handleKeyDown}
              className="rounded-3xl border border-orange-100 bg-white p-6 sm:p-9 shadow-xl shadow-orange-100/50 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
            >
              {/* ETAPA 1: NOME */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500">
                    <User className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Identificação
                    </span>
                  </div>
                  <div>
                    <label
                      htmlFor={`${formId}-nome`}
                      className="block text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-50"
                    >
                      Como podemos chamar você?
                    </label>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Digite seu nome completo ou como gosta de ser chamado(a).
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      id={`${formId}-nome`}
                      required
                      autoFocus
                      value={form.nome}
                      onChange={(e) => update('nome', e.target.value)}
                      placeholder="Ex.: Lucas Andrade"
                      className="min-h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-5 text-lg font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-500 dark:focus:ring-orange-950/60"
                    />
                    {form.nome.trim().length >= 2 && (
                      <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-emerald-500 animate-in zoom-in" />
                    )}
                  </div>
                  {form.nome.length > 0 && form.nome.trim().length < 2 && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Por favor, digite ao menos 2 caracteres.
                    </p>
                  )}
                </div>
              )}

              {/* ETAPA 2: TELEFONE / WHATSAPP */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500">
                    <Phone className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Contato direto
                    </span>
                  </div>
                  <div>
                    <label
                      htmlFor={`${formId}-telefone`}
                      className="block text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-50"
                    >
                      Qual o seu WhatsApp ou telefone?
                    </label>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Informe com o DDD (ex.: 71 para Salvador) para liberarmos seu prêmio.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      id={`${formId}-telefone`}
                      required
                      autoFocus
                      type="tel"
                      value={form.telefone}
                      onChange={(e) => update('telefone', formatPhoneBR(e.target.value))}
                      placeholder="(71) 99999-9999"
                      className="min-h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-5 text-lg font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-500 dark:focus:ring-orange-950/60"
                    />
                    {isValidPhone(form.telefone) && (
                      <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-emerald-500 animate-in zoom-in" />
                    )}
                  </div>
                  {form.telefone.length > 0 && !isValidPhone(form.telefone) && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Digite um número válido com DDD (10 ou 11 dígitos).
                    </p>
                  )}
                </div>
              )}

              {/* ETAPA 3: E-MAIL */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500">
                    <Send className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Comunicação</span>
                  </div>
                  <div>
                    <label
                      htmlFor={`${formId}-email`}
                      className="block text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-50"
                    >
                      Qual o seu melhor e-mail?
                    </label>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Para enviarmos dicas, notícias e o comprovante do seu agendamento.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      id={`${formId}-email`}
                      required
                      autoFocus
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="min-h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-5 text-lg font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-500 dark:focus:ring-orange-950/60"
                    />
                    {isValidEmail(form.email) && (
                      <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-emerald-500 animate-in zoom-in" />
                    )}
                  </div>
                  {form.email.length > 0 && !isValidEmail(form.email) && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Formato inválido. Certifique-se de incluir @ e o domínio (ex.:
                      nome@dominio.com).
                    </p>
                  )}
                </div>
              )}

              {/* ETAPA 4: OBJETIVO */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500">
                    <Target className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Seu Foco</span>
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-50">
                      Qual é o seu principal objetivo hoje?
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Selecione a opção que mais combina com o que você quer conquistar.
                    </p>
                  </div>
                  <div className="grid gap-2.5">
                    {objetivos.map((option) => {
                      const isSelected = form.objetivo === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => update('objetivo', option)}
                          className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left font-semibold transition-all duration-150 ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm dark:bg-orange-950/40 dark:text-orange-200'
                              : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-sm sm:text-base">{option}</span>
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="h-4 w-4" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ETAPA 5: PROXIMIDADE */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500">
                    <MapPin className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Localização</span>
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-50">
                      Mora ou trabalha perto do Itaigara?
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Nossa unidade fica no rooftop do Ed. Elvira Vidal Orge, no Alto do Itaigara.
                    </p>
                  </div>
                  <div className="grid gap-2.5">
                    {proximidades.map((option) => {
                      const isSelected = form.proximidade === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => update('proximidade', option)}
                          className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left font-semibold transition-all duration-150 ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm dark:bg-orange-950/40 dark:text-orange-200'
                              : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-sm sm:text-base">{option}</span>
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="h-4 w-4" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ETAPA 6: OCUPAÇÃO */}
              {currentStep === 6 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500">
                    <Briefcase className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Rotina</span>
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-50">
                      Qual é a sua ocupação atual?
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Isso ajuda nossos consultores a sugerirem os melhores horários de treino.
                    </p>
                  </div>
                  <div className="grid gap-2.5">
                    {ocupacoes.map((option) => {
                      const isSelected = form.ocupacao === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => update('ocupacao', option)}
                          className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left font-semibold transition-all duration-150 ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm dark:bg-orange-950/40 dark:text-orange-200'
                              : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-sm sm:text-base">{option}</span>
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="h-4 w-4" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ETAPA 7: INTERESSE EM VISITA + AJUDA HUMANA + CONSENTIMENTO */}
              {currentStep === 7 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500">
                    <Trophy className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Etapa Final • Resgate
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-50">
                      Você quer conhecer a academia e fazer uma aula experimental?
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Confirme seu interesse para desbloquear o prêmio da sua aula.
                    </p>
                  </div>

                  <div className="grid gap-2.5">
                    {interesses.map((option) => {
                      const isSelected = form.interesse_em_visita === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => update('interesse_em_visita', option)}
                          className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left font-semibold transition-all duration-150 ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm dark:bg-orange-950/40 dark:text-orange-200'
                              : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-sm sm:text-base">{option}</span>
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="h-4 w-4" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Ajuda Humana Opcional */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 text-sm text-slate-700 transition hover:bg-orange-50 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.precisa_de_ajuda_humana}
                      onChange={(e) => update('precisa_de_ajuda_humana', e.target.checked)}
                      className="mt-1 h-5 w-5 rounded accent-orange-600"
                    />
                    <div>
                      <strong className="block text-slate-900 dark:text-slate-100 font-bold">
                        Quero falar com uma pessoa
                      </strong>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        Tenho uma dúvida específica ou prefiro continuar com atendimento humano.
                      </span>
                    </div>
                  </label>

                  {/* Consentimento LGPD Obrigatório */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                    <input
                      type="checkbox"
                      required
                      checked={form.consentimento}
                      onChange={(e) => update('consentimento', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-orange-600"
                    />
                    <span>
                      Autorizo o contato da Fellice Fitness por WhatsApp, telefone ou e-mail para
                      agendamento da minha aula experimental e envio de informações sobre os planos
                      da academia.
                    </span>
                  </label>
                </div>
              )}

              {/* Mensagem de Erro Inline se houver */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900/40"
                >
                  {errorMessage}
                </div>
              )}

              {/* Rodapé do Formulário: Botões de Ação */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={status === 'sending'}
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!isValid}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-7 font-bold text-white shadow-lg shadow-orange-600/30 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    <span>Seguir</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!isValid || status === 'sending'}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-7 font-bold text-white shadow-lg shadow-orange-600/30 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    {status === 'sending' ? (
                      <span>Salvando...</span>
                    ) : (
                      <>
                        <span>Concluir e Ganhar Prêmio</span>
                        <Trophy className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>

            {/* Microcopy Motivacional Gamificado */}
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-orange-700/80 dark:text-orange-400/80 text-center">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span>{motivationalTips[currentStep - 1]}</span>
            </div>
          </div>
        )}
      </main>

      {/* Footer minimalista */}
      <footer className="border-t border-orange-100/60 bg-white/60 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
        <div className="mx-auto max-w-4xl px-5 flex flex-wrap items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Fellice Fitness • Terrazzo R1 Sports Club</p>
          <div className="flex items-center gap-4">
            <Link
              to="/agendar"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition"
            >
              Grade de Horários
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Dados protegidos
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Index
