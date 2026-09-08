import { useRef, useState } from 'react'

type Submission = {
  nome: string
  canal_de_retorno: string
  objetivo: string
  proximidade: string
  ocupacao: string
  interesse_em_visita: string
  precisa_de_ajuda_humana: boolean
  consentimento: boolean
}

const FORM_ID = 'fellice-captura-01'
const FORM_VERSION = 'v1.0.0'
const BACKEND_URL = import.meta.env.VITE_POCKETBASE_URL

const objetivos = [
  'Emagrecimento',
  'Ganho de massa muscular',
  'Condicionamento físico e resistência',
  'Saúde, mobilidade e qualidade de vida',
  'Recuperação de lesões',
  'Melhorar a performance esportiva',
  'Ainda não defini meu objetivo',
]

const proximidades = [
  'Moro no Itaigara ou em bairros vizinhos',
  'Trabalho na região do Itaigara',
  'Passo com frequência pela região',
  'Moro/trabalho em outra região, mas me desloco para treinar',
  'Ainda não conheço bem a região',
]

const ocupacoes = [
  'CLT',
  'Autônomo/Empresário',
  'Executivo/Gestor',
  'Estudante',
  'Aposentado',
  'Profissional da saúde, educação ou outra área com horário irregular',
  'Prefiro não informar',
]

const interesses = [
  'Sim, quero agendar uma visita presencial',
  'Sim, quero agendar uma aula experimental',
  'Quero receber mais informações antes de decidir',
  'Não tenho interesse no momento',
]

const initialForm: Submission = {
  nome: '',
  canal_de_retorno: '',
  objetivo: '',
  proximidade: '',
  ocupacao: '',
  interesse_em_visita: '',
  precisa_de_ajuda_humana: false,
  consentimento: false,
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

const SelectField = ({
  label,
  name,
  value,
  options,
  required = false,
  onChange,
}: {
  label: string
  name: string
  value: string
  options: string[]
  required?: boolean
  onChange: (value: string) => void
}) => (
  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
    {label} {required && <span className="text-orange-600">*</span>}
    <select
      name={name}
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-base font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
    >
      <option value="">Selecione uma opção</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
)

const Index = () => {
  const startedAt = useRef(new Date().toISOString())
  const leadSubmissionId = useRef(crypto.randomUUID())
  const startedEventRecorded = useRef(false)
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const update = (field: keyof Submission, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (status !== 'idle') setStatus('idle')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.consentimento) {
      setStatus('error')
      setMessage('É necessário autorizar o uso dos meios de contato para enviar a triagem.')
      return
    }
    setStatus('sending')
    setMessage('')
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
    try {
      await createRecord('lead_submissions', {
        lead_submission_id: leadSubmissionId.current,
        form_id: FORM_ID,
        form_version: FORM_VERSION,
        started_at: submissionStartedAt,
        submitted_at: now,
        nome: form.nome,
        canal_de_retorno: form.canal_de_retorno,
        objetivo: form.objetivo,
        proximidade: form.proximidade,
        ocupacao: form.ocupacao,
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
        lead_submission_id: leadSubmissionId,
        event_type: 'TRIAGEM_CONCLUIDA',
        occurred_at: now,
        payload: { form_id: FORM_ID, form_version: FORM_VERSION },
      })
      setStatus('success')
      setMessage(
        'Recebemos suas informações. A equipe da Fellice Fitness poderá entrar em contato pelo canal informado.',
      )
      setForm(initialForm)
      startedAt.current = new Date().toISOString()
      leadSubmissionId.current = crypto.randomUUID()
      startedEventRecorded.current = false
    } catch (error) {
      console.error(error)
      setStatus('error')
      setMessage('Não foi possível salvar agora. Confira os dados e tente novamente.')
    }
  }

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

  return (
    <div className="min-h-screen bg-[#fffaf5] text-slate-900">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-600">
              Fellice Fitness
            </p>
            <p className="mt-1 text-sm text-slate-500">Terrazzo R1 Sports Club</p>
          </div>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            Triagem {FORM_VERSION}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <section className="pt-2 lg:sticky lg:top-8">
          <p className="mb-4 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-700">
            Conheça a academia
          </p>
          <h1 className="max-w-xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
            Vamos entender o que você busca para treinar melhor.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
            Responda algumas perguntas rápidas. Assim nossa equipe prepara um atendimento mais útil
            para você.
          </p>
          <div className="mt-8 space-y-4 text-sm text-slate-600">
            <p>
              <strong className="text-slate-900">1.</strong> Conte seu objetivo e sua relação com a
              região.
            </p>
            <p>
              <strong className="text-slate-900">2.</strong> Informe o melhor canal para retorno.
            </p>
            <p>
              <strong className="text-slate-900">3.</strong> Se preferir, peça ajuda humana no
              final.
            </p>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          onFocus={recordStart}
          className="rounded-3xl border border-orange-100 bg-white p-6 shadow-xl shadow-orange-100/50 sm:p-9"
        >
          <div className="mb-8 border-b border-slate-100 pb-5">
            <h2 className="text-2xl font-bold text-slate-950">Sua triagem inicial</h2>
            <p className="mt-2 text-sm text-slate-500">
              <span className="text-orange-600">*</span> Campos obrigatórios
            </p>
          </div>

          <div className="space-y-6">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Como podemos chamar você?{' '}
              <span>
                <span className="text-orange-600">*</span>
              </span>
              <input
                required
                value={form.nome}
                onChange={(event) => update('nome', event.target.value)}
                placeholder="Seu nome"
                className="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-normal outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Qual o melhor canal para retorno?{' '}
              <span>
                <span className="text-orange-600">*</span>
              </span>
              <input
                required
                value={form.canal_de_retorno}
                onChange={(event) => update('canal_de_retorno', event.target.value)}
                placeholder="WhatsApp, telefone ou e-mail"
                className="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-normal outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <SelectField
              label="Mora ou trabalha perto?"
              name="proximidade"
              value={form.proximidade}
              options={proximidades}
              required
              onChange={(value) => update('proximidade', value)}
            />
            <SelectField
              label="Qual é o seu principal objetivo hoje?"
              name="objetivo"
              value={form.objetivo}
              options={objetivos}
              required
              onChange={(value) => update('objetivo', value)}
            />
            <SelectField
              label="Qual é a sua ocupação atual?"
              name="ocupacao"
              value={form.ocupacao}
              options={ocupacoes}
              onChange={(value) => update('ocupacao', value)}
            />
            <SelectField
              label="Você quer conhecer a academia e fazer uma aula experimental?"
              name="interesse_em_visita"
              value={form.interesse_em_visita}
              options={interesses}
              required
              onChange={(value) => update('interesse_em_visita', value)}
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.precisa_de_ajuda_humana}
                onChange={(event) => update('precisa_de_ajuda_humana', event.target.checked)}
                className="mt-1 h-4 w-4 accent-orange-600"
              />
              <span>
                <strong className="block text-slate-900">Quero falar com uma pessoa</strong>Tenho
                uma dúvida ou prefiro continuar com atendimento humano.
              </span>
            </label>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-600">
              <input
                type="checkbox"
                required
                checked={form.consentimento}
                onChange={(event) => update('consentimento', event.target.checked)}
                className="mt-1 h-4 w-4 accent-orange-600"
              />
              <span>
                O lead autoriza que a ACADEMIA se utilize dos meios eletrônicos (e-mail, telefone,
                mensagens SMS e Whatsapp) com o objetivo de enviar notícias, avisos, dicas,
                promoções e outras informações relevantes acerca do funcionamento da academia.
              </span>
            </label>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="mt-5 min-h-12 w-full rounded-xl bg-orange-600 px-5 font-bold text-white transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
            >
              {status === 'sending' ? 'Enviando...' : 'Enviar minha triagem'}
            </button>
            {message && (
              <p
                role="status"
                className={`mt-4 rounded-xl p-4 text-sm ${status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}
              >
                {message}
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}

export default Index
