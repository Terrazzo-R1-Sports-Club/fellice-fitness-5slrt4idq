import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

const triagemSchema = z.object({
  nome: z.string().trim().min(1, 'Informe como podemos chamar você.'),
  canal_de_retorno: z.string().trim().min(1, 'Informe o melhor canal para retorno.'),
  proximidade: z.string().min(1, 'Selecione onde você mora ou trabalha.'),
  objetivo: z.string().min(1, 'Selecione seu principal objetivo.'),
  ocupacao: z.string(),
  interesse_em_visita: z.string().min(1, 'Selecione seu interesse na aula experimental.'),
  precisa_de_ajuda_humana: z.boolean(),
  consentimento: z.boolean().refine((value) => value === true, {
    message: 'É necessário autorizar o uso dos meios de contato para enviar a triagem.',
  }),
})

type Submission = z.infer<typeof triagemSchema>

const defaultValues: Submission = {
  nome: '',
  canal_de_retorno: '',
  proximidade: '',
  objetivo: '',
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
  options,
  required = false,
  control,
}: {
  label: string
  name: keyof Submission
  options: string[]
  required?: boolean
  control: Control<Submission>
}) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>
          {label} {required && <span className="text-primary">*</span>}
        </FormLabel>
        <Select value={field.value} onValueChange={field.onChange}>
          <FormControl>
            <SelectTrigger className="min-h-12 w-full text-base">
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
)

const Index = () => {
  const startedAt = useRef(new Date().toISOString())
  const leadSubmissionId = useRef(crypto.randomUUID())
  const startedEventRecorded = useRef(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const form = useForm<Submission>({
    resolver: zodResolver(triagemSchema),
    defaultValues,
  })

  useEffect(() => {
    const subscription = form.watch(() => {
      setStatus((current) => (current === 'error' ? 'idle' : current))
    })
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (values: Submission) => {
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
        nome: values.nome,
        canal_de_retorno: values.canal_de_retorno,
        objetivo: values.objetivo,
        proximidade: values.proximidade,
        ocupacao: values.ocupacao,
        interesse_em_visita: values.interesse_em_visita,
        precisa_de_ajuda_humana: values.precisa_de_ajuda_humana,
        consentimento: values.consentimento,
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
        payload: { form_id: FORM_ID, form_version: FORM_VERSION },
      })
      if (values.precisa_de_ajuda_humana) {
        const handoffId = crypto.randomUUID()
        await createRecord('lead_handoffs', {
          handoff_id: handoffId,
          lead_submission_id: leadSubmissionId.current,
          form_id: FORM_ID,
          form_version: FORM_VERSION,
          created_at: now,
          motivo: 'PEDIDO_DE_AJUDA_HUMANA',
          nome: values.nome,
          canal_de_retorno: values.canal_de_retorno,
          objetivo: values.objetivo,
          proximidade: values.proximidade,
          ocupacao: values.ocupacao,
          interesse_em_visita: values.interesse_em_visita,
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
      setStatus('success')
      setMessage(
        'Recebemos suas informações. A equipe da Fellice Fitness poderá entrar em contato pelo canal informado.',
      )
      form.reset(defaultValues)
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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur transition-colors duration-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Fellice Fitness
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Terrazzo R1 Sports Club</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Triagem {FORM_VERSION}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <section className="pt-2 lg:sticky lg:top-8">
          <p className="mb-4 inline-flex rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground">
            Conheça a academia
          </p>
          <h1 className="max-w-xl text-4xl font-black leading-tight tracking-tight text-foreground sm:text-5xl">
            Vamos entender o que você busca para treinar melhor.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
            Responda algumas perguntas rápidas. Assim nossa equipe prepara um atendimento mais útil
            para você.
          </p>
          <div className="mt-8 space-y-4 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">1.</strong> Conte seu objetivo e sua relação com a
              região.
            </p>
            <p>
              <strong className="text-foreground">2.</strong> Informe o melhor canal para retorno.
            </p>
            <p>
              <strong className="text-foreground">3.</strong> Se preferir, peça ajuda humana no
              final.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="mt-6 border-primary/30 font-bold text-primary hover:bg-secondary hover:text-secondary-foreground"
          >
            <Link to="/agendar">Prefere escolher um horário? Agende aqui</Link>
          </Button>
        </section>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            onFocus={recordStart}
            className="rounded-3xl border border-border bg-card p-6 shadow-elevation transition-colors duration-200 sm:p-9"
          >
            <div className="mb-8 border-b border-border pb-5">
              <h2 className="text-2xl font-bold text-foreground">Sua triagem inicial</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="text-primary">*</span> Campos obrigatórios
              </p>
            </div>

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Como podemos chamar você? <span className="text-primary">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" className="min-h-12 text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="canal_de_retorno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Qual o melhor canal para retorno? <span className="text-primary">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="WhatsApp, telefone ou e-mail"
                        className="min-h-12 text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SelectField
                label="Mora ou trabalha perto?"
                name="proximidade"
                options={proximidades}
                required
                control={form.control}
              />
              <SelectField
                label="Qual é o seu principal objetivo hoje?"
                name="objetivo"
                options={objetivos}
                required
                control={form.control}
              />
              <SelectField
                label="Qual é a sua ocupação atual?"
                name="ocupacao"
                options={ocupacoes}
                control={form.control}
              />
              <SelectField
                label="Você quer conhecer a academia e fazer uma aula experimental?"
                name="interesse_em_visita"
                options={interesses}
                required
                control={form.control}
              />
              <FormField
                control={form.control}
                name="precisa_de_ajuda_humana"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-2xl border border-primary/20 bg-secondary/60 p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-1"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="font-semibold text-foreground">
                        Quero falar com uma pessoa
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Tenho uma dúvida ou prefiro continuar com atendimento humano.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <FormField
                control={form.control}
                name="consentimento"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-xs font-normal leading-5 text-muted-foreground">
                        O lead autoriza que a ACADEMIA se utilize dos meios eletrônicos (e-mail,
                        telefone, mensagens SMS e Whatsapp) com o objetivo de enviar notícias,
                        avisos, dicas, promoções e outras informações relevantes acerca do
                        funcionamento da academia.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                size="lg"
                disabled={status === 'sending'}
                className="mt-5 min-h-12 w-full text-base font-bold"
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="animate-spin" /> Enviando...
                  </>
                ) : (
                  'Enviar minha triagem'
                )}
              </Button>
              {message && (
                <p
                  role="status"
                  className={`mt-4 rounded-xl p-4 text-sm ${
                    status === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                  }`}
                >
                  {message}
                </p>
              )}
            </div>
          </form>
        </Form>
      </main>
    </div>
  )
}

export default Index
