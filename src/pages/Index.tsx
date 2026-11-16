import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  Heart,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { avaliarElegibilidade } from '@/lib/elegibilidade'
import type { ResultadoElegibilidade } from '@/lib/elegibilidade'
import { calcularPrioridade } from '@/lib/prioridade'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

const FORM_ID = 'fellice-captura-01'
const FORM_VERSION = 'v1.2.1'

// REF-07 — vídeos do formulário (insumos 4/4 aprovados pelo consultor em 17–18/11/2026,
// registrados em 04_fase-atual/ref07-insumos.md). Mídias do Drive da cliente, exibidas
// pelo player embutido do Google Drive (iframe /preview); reprodução automática e
// NÃO bloqueante — avançar nunca depende do vídeo. Sem upload, conversão ou tracking novo.
const VIDEO_DIFERENCIAIS = '1OWAIuHhBk76_dmt7dzKOb-nOi5rEK8e2'
const VIDEO_POR_OBJETIVO: Record<string, string> = {
  Emagrecimento: '1izYU8RrUkx2dQRAMVVoD1HePVlJ9YDcx',
  'Ganho de massa muscular': '1uZ_e4on5WJucL6flgEuvzIR2uNAYRpkT',
  'Condicionamento físico e resistência': '1ZUfnoXanlLzYl3nABYQJU1nqA46uDlTy',
  'Saúde, mobilidade e qualidade de vida': '1iwR-xN4CDskj-EtOMQqzZINCy4Ld0rWk',
}
// Objetivos sem vídeo (etapa segue direta): Recuperação de lesões,
// Melhorar a performance esportiva e Ainda não defini meu objetivo.
const BACKEND_URL = import.meta.env.VITE_POCKETBASE_URL
const WHATSAPP_ATENDIMENTO = '5571993960018'

const OBJETIVOS = [
  {
    id: 'Emagrecimento',
    title: 'Emagrecimento',
    desc: 'Redução de gordura corporal de forma sustentável e saudável',
    icon: Zap,
  },
  {
    id: 'Ganho de massa muscular',
    title: 'Ganho de massa muscular',
    desc: 'Hipertrofia, definição e fortalecimento muscular com metodologia',
    icon: Dumbbell,
  },
  {
    id: 'Condicionamento físico e resistência',
    title: 'Condicionamento & Resistência',
    desc: 'Mais fôlego, energia e disposição para o dia a dia',
    icon: Sparkles,
  },
  {
    id: 'Saúde, mobilidade e qualidade de vida',
    title: 'Saúde & Mobilidade',
    desc: 'Longevidade, alívio de tensões e qualidade de vida no rooftop',
    icon: Heart,
  },
  {
    id: 'Recuperação de lesões',
    title: 'Recuperação de lesões',
    desc: 'Acompanhamento preventivo e reabilitação orientada',
    icon: Heart,
  },
  {
    id: 'Melhorar a performance esportiva',
    title: 'Performance esportiva',
    desc: 'Potência, agilidade e rendimento para esportistas e atletas',
    icon: Trophy,
  },
  {
    id: 'Ainda não defini meu objetivo',
    title: 'Ainda estou definindo',
    desc: 'Quero orientação dos especialistas para escolher o melhor caminho',
    icon: HelpCircle,
  },
]

const PROXIMIDADES = [
  {
    id: 'Moro no Itaigara ou em bairros vizinhos',
    title: 'Moro no Itaigara ou vizinhança',
    desc: 'Pituba, Caminho das Árvores, Santa Teresa, Brotas, etc.',
    tag: 'Vizinho do Club',
  },
  {
    id: 'Trabalho na região do Itaigara',
    title: 'Trabalho na região do Itaigara',
    desc: 'Empresariais, clínicas, escolas ou comércios locais',
    tag: 'Treino no intervalo',
  },
  {
    id: 'Passo com frequência pela região',
    title: 'Passo com frequência por aqui',
    desc: 'Na rota diária de deslocamento em Salvador',
    tag: 'Fácil acesso',
  },
  {
    id: 'Moro/trabalho em outra região, mas me desloco para treinar',
    title: 'Me desloco de outra região',
    desc: 'Busco a infraestrutura exclusiva e a vista panorâmica do rooftop',
    tag: 'Destino exclusivo',
  },
  {
    id: 'Ainda não conheço bem a região',
    title: 'Ainda não conheço bem a região',
    desc: 'Quero conhecer a localização no Alto do Itaigara',
    tag: 'Primeira visita',
  },
]

// REF-03 — lista aprovada pela cliente em 29/10/2026. O id é o valor interno
// gravado em lead_submissions.ocupacao (campo select); rótulos não mudam
// valores internos nem semântica histórica (regra 5 da SPEC).
const OCUPACOES = [
  { id: 'CLT', title: 'Profissional CLT', desc: 'Horário comercial e rotina corporativa' },
  {
    id: 'Autônomo',
    title: 'Autônomo',
    desc: 'Trabalho por conta própria com agenda própria',
  },
  {
    id: 'Empresário',
    title: 'Empresário',
    desc: 'Gestão do próprio negócio e equipe',
  },
  {
    id: 'Diretor ou alta gerência',
    title: 'Diretor ou alta gerência',
    desc: 'Liderança e rotina de alta demanda',
  },
  { id: 'Estudante', title: 'Estudante', desc: 'Graduação, pós-graduação ou concursos' },
  { id: 'Aposentado', title: 'Aposentado', desc: 'Foco em saúde, lazer e longevidade' },
  {
    id: 'Prefiro não informar',
    title: 'Prefiro não informar',
    desc: 'Sem restrições de categoria',
  },
]

// REF-03 — pergunta secundária de profissão, aprovada pela cliente em 29/10/2026.
// Obrigatória para CLT e Autônomo; "Outros" coleta texto livre (aprovado).
const PROFISSOES_CLT = [
  'Assistente administrativo',
  'Vendedor',
  'Técnico de enfermagem',
  'Médico',
  'Engenheiro',
  'Outros',
]

const PROFISSOES_AUTONOMO = [
  'Cabeleireiro',
  'Eletricista',
  'Advogado',
  'Dentista',
  'Médico',
  'Outros',
]

const INTERESSES = [
  {
    id: 'Sim, quero agendar uma aula experimental',
    title: 'Sim! Quero agendar uma aula experimental',
    desc: 'Viver a experiência completa no rooftop do Terrazzo R1 Sports Club',
    highlight: true,
  },
  {
    id: 'Sim, quero agendar uma visita presencial',
    title: 'Quero fazer um tour presencial primeiro',
    desc: 'Conhecer a infraestrutura, vestiários e conversar com a equipe',
    highlight: false,
  },
  {
    id: 'Quero receber mais informações antes de decidir',
    title: 'Quero receber mais informações antes',
    desc: 'Tirar dúvidas sobre planos, modalidades e valores pelo WhatsApp',
    highlight: false,
  },
  {
    id: 'Não tenho interesse no momento',
    title: 'Não tenho interesse no momento',
    desc: 'Apenas pesquisando opções no Alto do Itaigara',
    highlight: false,
  },
]

const ETAPAS_INFO = [
  {
    numero: 1,
    titulo: 'Identificação',
    pergunta: 'Como podemos chamar você?',
    subtitulo: 'Informe seu nome completo para personalizarmos seu atendimento.',
    microcopy: 'Etapa 1 de 7 — Comece sua jornada rumo à melhor versão!',
  },
  {
    numero: 2,
    titulo: 'WhatsApp',
    pergunta: 'Qual é o seu WhatsApp para contato?',
    subtitulo: 'Enviaremos a confirmação da sua aula experimental diretamente por ele.',
    microcopy: 'Etapa 2 de 7 — Usamos seu número apenas para informações essenciais.',
  },
  {
    numero: 3,
    titulo: 'E-mail',
    pergunta: 'Qual o seu melhor e-mail?',
    subtitulo: 'Para receber avisos exclusivos, promoções e o resumo da sua experiência.',
    microcopy: 'Etapa 3 de 7 — Quase na metade! Não enviamos spam.',
  },
  {
    numero: 4,
    titulo: 'Objetivo',
    pergunta: 'Qual é o seu principal objetivo hoje?',
    subtitulo: 'Nossos treinadores adaptam a aula experimental ao que você busca.',
    microcopy: 'Etapa 4 de 7 — O primeiro passo para transformar sua rotina!',
  },
  {
    numero: 5,
    titulo: 'Localização',
    pergunta: 'Qual a sua relação com o Alto do Itaigara?',
    subtitulo: 'Nosso rooftop exclusivo fica no Terrazzo R1 Sports Club.',
    microcopy: 'Etapa 5 de 7 — Treinar perto de casa ou do trabalho faz toda a diferença!',
  },
  {
    numero: 6,
    titulo: 'Rotina',
    pergunta: 'Como é a sua rotina de trabalho ou estudos?',
    subtitulo: 'Isso nos ajuda a sugerir os melhores horários de treino.',
    microcopy: 'Etapa 6 de 7 — Falta só mais uma etapa para concluir sua triagem!',
  },
  {
    numero: 7,
    titulo: 'Confirmação',
    pergunta: 'Pronto para conhecer o nosso rooftop?',
    subtitulo: 'Escolha como prefere iniciar sua experiência e confirme sua autorização.',
    microcopy: 'Etapa 7 de 7 — Conclua agora para finalizar sua triagem!',
  },
]

export interface LeadFormData {
  nome: string
  telefone: string
  email: string
  objetivo: string
  proximidade: string
  ocupacao: string
  profissao: string
  profissao_outros: string
  interesse_em_visita: string
  precisa_de_ajuda_humana: boolean
  consentimento: boolean
}

const initialFormData: LeadFormData = {
  nome: '',
  telefone: '',
  email: '',
  objetivo: '',
  proximidade: '',
  ocupacao: '',
  profissao: '',
  profissao_outros: '',
  interesse_em_visita: '',
  precisa_de_ajuda_humana: false,
  consentimento: false,
}

// REF-03 — a profissão só é perguntada para CLT e Autônomo (obrigatória).
const profissaoAplicavel = (ocupacao: string): boolean =>
  ocupacao === 'CLT' || ocupacao === 'Autônomo'

function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 10 && digits.length !== 11) return false
  const ddd = Number(digits.slice(0, 2))
  if (ddd < 11 || ddd > 99) return false
  if (digits.length === 11 && digits[2] !== '9') return false
  return true
}

function isValidEmail(value: string): boolean {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return pattern.test(value.trim())
}

async function createRecord(collection: string, data: Record<string, unknown>) {
  if (!BACKEND_URL) throw new Error('Backend do Skip não configurado')
  const response = await fetch(`${BACKEND_URL}/api/collections/${collection}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Falha ao salvar (${response.status}): ${errorText}`)
  }
  return response.json()
}

export function Index() {
  const [etapaAtual, setEtapaAtual] = useState<number>(1)
  const [formData, setFormData] = useState<LeadFormData>(initialFormData)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [statusEnvio, setStatusEnvio] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  // REF-06 — resultado da elegibilidade quando o perfil não qualifica (tela de encaminhamento)
  const [elegibilidadeBloqueio, setElegibilidadeBloqueio] = useState<ResultadoElegibilidade | null>(
    null,
  )
  const [erroEnvio, setErroEnvio] = useState<string>('')

  const startedAt = useRef(new Date().toISOString())
  const leadSubmissionId = useRef(crypto.randomUUID())
  const startedEventRecorded = useRef(false)
  const inputNomeId = useId()
  const inputTelefoneId = useId()
  const inputEmailId = useId()

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
    } catch (err) {
      console.warn('Não foi possível registrar FORM_STARTED', err)
    }
  }

  useEffect(() => {
    recordStart()
  }, [])

  const validarEtapa = (etapa: number): boolean => {
    const novosErros: Record<string, string> = {}

    switch (etapa) {
      case 1: {
        const nomeLimpo = formData.nome.trim()
        if (!nomeLimpo) {
          novosErros.nome = 'Por favor, informe seu nome completo.'
        } else if (nomeLimpo.length < 3) {
          novosErros.nome = 'O nome deve ter pelo menos 3 caracteres.'
        }
        break
      }
      case 2: {
        if (!formData.telefone.trim()) {
          novosErros.telefone = 'Informe seu número de WhatsApp com DDD.'
        } else if (!isValidBrazilianPhone(formData.telefone)) {
          novosErros.telefone =
            'Digite um número de telefone/WhatsApp válido com DDD (ex: (71) 99999-9999).'
        }
        break
      }
      case 3: {
        if (!formData.email.trim()) {
          novosErros.email = 'Informe seu e-mail para contato.'
        } else if (!isValidEmail(formData.email)) {
          novosErros.email = 'Digite um formato de e-mail válido (ex: seu.nome@email.com).'
        }
        break
      }
      case 4: {
        if (!formData.objetivo) {
          novosErros.objetivo = 'Selecione uma opção de objetivo para continuar.'
        }
        break
      }
      case 5: {
        if (!formData.proximidade) {
          novosErros.proximidade = 'Selecione sua relação com a região do Alto do Itaigara.'
        }
        break
      }
      case 6: {
        if (!formData.ocupacao) {
          novosErros.ocupacao = 'Selecione a opção que melhor descreve sua rotina.'
          break
        }
        // REF-03 — pergunta secundária obrigatória para CLT e Autônomo.
        if (profissaoAplicavel(formData.ocupacao)) {
          if (!formData.profissao) {
            novosErros.profissao = 'Selecione sua profissão para continuar.'
          } else if (formData.profissao === 'Outros' && !formData.profissao_outros.trim()) {
            novosErros.profissao_outros = 'Descreva sua profissão para continuar.'
          }
        }
        break
      }
      case 7: {
        if (!formData.interesse_em_visita) {
          novosErros.interesse_em_visita =
            'Selecione se deseja aula experimental, visita ou informações.'
        }
        if (!formData.consentimento) {
          novosErros.consentimento =
            'É necessário autorizar o contato da academia para enviar a triagem.'
        }
        break
      }
      default:
        break
    }

    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  const handleAvancar = () => {
    if (!validarEtapa(etapaAtual)) {
      return
    }
    if (etapaAtual < 7) {
      setEtapaAtual((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      handleFinalizar()
    }
  }

  const handleVoltar = () => {
    if (etapaAtual > 1) {
      setErros({})
      setEtapaAtual((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleFinalizar = async () => {
    if (!validarEtapa(7)) return

    setStatusEnvio('sending')
    setErroEnvio('')
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

    const canalDeRetorno = `${formData.telefone.trim()} | ${formData.email.trim()}`

    // REF-03 — profissão da pergunta secundária; "Outros" grava o texto livre
    // informado pelo lead (campo texto, não select).
    const profissaoFinal =
      formData.profissao === 'Outros'
        ? `Outros: ${formData.profissao_outros.trim()}`
        : formData.profissao

    // REF-05 — pontuação determinística (matriz v1) calculada na conclusão da
    // triagem e gravada junto da submissão; valor e motivo rastreáveis.
    const prioridade = calcularPrioridade(formData.ocupacao, profissaoFinal)

    try {
      await createRecord('lead_submissions', {
        lead_submission_id: leadSubmissionId.current,
        form_id: FORM_ID,
        form_version: FORM_VERSION,
        started_at: submissionStartedAt,
        submitted_at: now,
        nome: formData.nome.trim(),
        canal_de_retorno: canalDeRetorno,
        objetivo: formData.objetivo,
        proximidade: formData.proximidade,
        ocupacao: formData.ocupacao,
        profissao: profissaoFinal,
        prioridade_nota: prioridade.nota,
        prioridade_faixa: prioridade.faixa,
        prioridade_matriz: prioridade.matriz,
        prioridade_motivo: prioridade.motivo,
        interesse_em_visita: formData.interesse_em_visita,
        precisa_de_ajuda_humana: formData.precisa_de_ajuda_humana,
        consentimento: formData.consentimento,
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
          telefone: formData.telefone.trim(),
          email: formData.email.trim(),
          profissao: profissaoFinal,
          prioridade_nota: prioridade.nota,
          prioridade_faixa: prioridade.faixa,
          prioridade_matriz: prioridade.matriz,
          prioridade_motivo: prioridade.motivo,
        },
      })

      if (formData.precisa_de_ajuda_humana) {
        const handoffId = crypto.randomUUID()
        await createRecord('lead_handoffs', {
          handoff_id: handoffId,
          lead_submission_id: leadSubmissionId.current,
          form_id: FORM_ID,
          form_version: FORM_VERSION,
          created_at: now,
          motivo: 'PEDIDO_DE_AJUDA_HUMANA',
          nome: formData.nome.trim(),
          canal_de_retorno: canalDeRetorno,
          objetivo: formData.objetivo,
          proximidade: formData.proximidade,
          ocupacao: formData.ocupacao,
          profissao: profissaoFinal,
          prioridade_nota: prioridade.nota,
          prioridade_faixa: prioridade.faixa,
          prioridade_matriz: prioridade.matriz,
          prioridade_motivo: prioridade.motivo,
          interesse_em_visita: formData.interesse_em_visita,
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

      // REF-06 / SPEC-4-004 (CA-4-R06) — elegibilidade por perfil no fim da triagem.
      // Ajuda humana é exceção (insumo 3): quem pediu atendimento humano não é bloqueado.
      // NAO_QUALIFICADO e AUSENTE → handoff na Fila; sem grade e sem oferta de WhatsApp.
      const elegibilidade = avaliarElegibilidade(
        formData.proximidade,
        formData.ocupacao,
        profissaoFinal,
      )
      const ajudaHumana = formData.precisa_de_ajuda_humana === true
      if (!ajudaHumana && elegibilidade.veredito !== 'QUALIFICADO') {
        const handoffId = crypto.randomUUID()
        await createRecord('lead_handoffs', {
          handoff_id: handoffId,
          lead_submission_id: leadSubmissionId.current,
          form_id: FORM_ID,
          form_version: FORM_VERSION,
          created_at: now,
          motivo: elegibilidade.motivo,
          nome: formData.nome.trim(),
          canal_de_retorno: canalDeRetorno,
          objetivo: formData.objetivo,
          proximidade: formData.proximidade,
          ocupacao: formData.ocupacao,
          profissao: profissaoFinal,
          prioridade_nota: prioridade.nota,
          prioridade_faixa: prioridade.faixa,
          prioridade_matriz: prioridade.matriz,
          prioridade_motivo: prioridade.motivo,
          interesse_em_visita: formData.interesse_em_visita,
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
          payload: { status: 'PENDENTE', motivo: elegibilidade.motivo },
        })
        setElegibilidadeBloqueio(elegibilidade)
      }

      setStatusEnvio('success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Erro ao enviar triagem:', error)
      setStatusEnvio('error')
      setErroEnvio('Não foi possível salvar agora. Por favor, confira os dados e tente novamente.')
    }
  }

  const etapaInfo = ETAPAS_INFO[etapaAtual - 1]
  const porcentagemProgresso = Math.round((etapaAtual / 7) * 100)

  const mensagemWhatsApp = encodeURIComponent(
    `Olá! Meu nome é ${formData.nome.trim() || 'Cliente'} e completei a triagem da Fellice Fitness no Terrazzo R1 Sports Club. Meu objetivo é: ${formData.objetivo || 'Treino'} e gostaria de agendar minha Aula Experimental Gratuita!`,
  )
  const linkWhatsApp = `https://wa.me/${WHATSAPP_ATENDIMENTO}?text=${mensagemWhatsApp}`

  // REF-02 / SPEC-4-004 — levar as respostas já preenchidas até o agendamento.
  // O transporte é o estado de navegação do roteador (mesma sessão de atendimento,
  // sem dados na URL e sem armazenamento local). O identificador da submissão é
  // preservado para não criar lead/agendamento duplicado (contrato B3-03).
  const navigate = useNavigate()
  const irParaGrade = () => {
    navigate('/agendar', {
      state: {
        lead_submission_id: leadSubmissionId.current,
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim(),
        email: formData.email.trim(),
        proximidade: formData.proximidade,
        ocupacao: formData.ocupacao,
        profissao:
          formData.profissao === 'Outros'
            ? `Outros: ${formData.profissao_outros.trim()}`
            : formData.profissao,
        prioridade: calcularPrioridade(
          formData.ocupacao,
          formData.profissao === 'Outros'
            ? `Outros: ${formData.profissao_outros.trim()}`
            : formData.profissao,
        ),
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
              <p className="text-sm font-medium text-muted-foreground">
                Terrazzo R1 Sports Club · Rua Rubens Guelli, 68 - Terraço - Itaigara, Salvador - BA,
                41815-135
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex border-primary/30 text-xs font-semibold text-primary hover:bg-secondary"
            >
              <Link to="/agendar">Horários de Visita</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {statusEnvio === 'success' && elegibilidadeBloqueio ? (
          <div className="rounded-3xl border border-orange-200 bg-card p-6 shadow-2xl transition-all duration-300 sm:p-10">
            <div className="text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <HelpCircle className="h-10 w-10" />
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                <CheckCircle2 className="h-4 w-4" /> Triagem Concluída
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                Recebemos suas respostas, {formData.nome.trim()}!
              </h1>
              <p className="mt-3 text-lg font-medium text-foreground">
                Com base nas suas respostas, nossa equipe vai entrar em contato para encontrar o
                melhor caminho com você.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Seu atendimento foi encaminhado para a equipe da Fellice Fitness (Terrazzo R1 Sports
                Club), que falará com você pelo canal informado.
              </p>
            </div>

            <div className="mt-8 text-center">
              <Button
                variant="ghost"
                onClick={() => {
                  setFormData(initialFormData)
                  setEtapaAtual(1)
                  setStatusEnvio('idle')
                  setElegibilidadeBloqueio(null)
                  leadSubmissionId.current = crypto.randomUUID()
                  startedAt.current = new Date().toISOString()
                  startedEventRecorded.current = false
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Preencher nova triagem
              </Button>
            </div>
          </div>
        ) : statusEnvio === 'success' ? (
          <div className="rounded-3xl border border-emerald-500/30 bg-card p-6 shadow-2xl transition-all duration-300 sm:p-10">
            <div className="text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Trophy className="h-10 w-10" />
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Triagem Concluída com Sucesso
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                Parabéns, {formData.nome.trim()}!
              </h1>
              <p className="mt-3 text-lg font-medium text-foreground">
                Seu prêmio de{' '}
                <strong className="text-primary font-black">Aula Experimental Gratuita</strong> está
                desbloqueado no rooftop do Alto do Itaigara!
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Recebemos suas preferências e nossa equipe já preparou seu atendimento VIP.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-primary/20 bg-secondary/60 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-primary p-3 text-primary-foreground shadow-md">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-foreground">
                    Resgate sua Aula Experimental Gratuita agora
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Clique no botão abaixo para conversar diretamente com nosso atendimento no
                    WhatsApp oficial <strong className="text-foreground">(71 99396-0018)</strong> e
                    agendar seu melhor dia e horário no rooftop do Terrazzo R1.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Button
                  asChild
                  size="lg"
                  className="flex-1 min-h-12 bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 text-base"
                >
                  <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Resgatar Aula pelo WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="min-h-12 border-primary/30 font-semibold"
                >
                  <Link
                    to="/agendar"
                    onClick={(e) => {
                      e.preventDefault()
                      irParaGrade()
                    }}
                  >
                    Ver grade de horários
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-background/50 p-4 sm:p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Resumo da sua triagem
              </h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <span className="text-muted-foreground">WhatsApp:</span>{' '}
                  <strong className="text-foreground">{formData.telefone}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail:</span>{' '}
                  <strong className="text-foreground">{formData.email}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Objetivo:</span>{' '}
                  <strong className="text-foreground">{formData.objetivo}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Relação local:</span>{' '}
                  <strong className="text-foreground">{formData.proximidade}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Rotina:</span>{' '}
                  <strong className="text-foreground">{formData.ocupacao}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Interesse:</span>{' '}
                  <strong className="text-foreground">{formData.interesse_em_visita}</strong>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <Button
                variant="ghost"
                onClick={() => {
                  setFormData(initialFormData)
                  setEtapaAtual(1)
                  setStatusEnvio('idle')
                  setElegibilidadeBloqueio(null)
                  leadSubmissionId.current = crypto.randomUUID()
                  startedAt.current = new Date().toISOString()
                  startedEventRecorded.current = false
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Preencher nova triagem
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-elevation transition-all sm:p-8">
              <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> Fase {etapaInfo.numero} de 7 ·{' '}
                    {etapaInfo.titulo}
                  </span>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                    {etapaInfo.pergunta}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">{etapaInfo.subtitulo}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-primary">{porcentagemProgresso}%</span>
                  <p className="text-xs text-muted-foreground">concluído</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${porcentagemProgresso}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-primary">{etapaInfo.microcopy}</p>
              </div>

              <div className="mt-8 min-h-[220px]">
                {etapaAtual === 1 && (
                  <div className="space-y-4">
                    <label
                      htmlFor={inputNomeId}
                      className="block text-sm font-semibold text-foreground"
                    >
                      Nome completo <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id={inputNomeId}
                        type="text"
                        placeholder="Ex: Mariana Silva Santos"
                        value={formData.nome}
                        onChange={(e) => {
                          setFormData({ ...formData, nome: e.target.value })
                          if (erros.nome) setErros({ ...erros, nome: '' })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAvancar()
                          }
                        }}
                        autoFocus
                        className="min-h-14 pl-12 text-base font-medium rounded-2xl"
                      />
                    </div>
                    {erros.nome && (
                      <p className="text-sm font-medium text-destructive">{erros.nome}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Usamos seu nome para preparar sua recepção no rooftop da academia.
                    </p>
                  </div>
                )}

                {etapaAtual === 2 && (
                  <div className="space-y-4">
                    <label
                      htmlFor={inputTelefoneId}
                      className="block text-sm font-semibold text-foreground"
                    >
                      WhatsApp ou telefone com DDD <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id={inputTelefoneId}
                        type="tel"
                        placeholder="(71) 99999-9999"
                        value={formData.telefone}
                        onChange={(e) => {
                          const formatted = formatBrazilianPhone(e.target.value)
                          setFormData({ ...formData, telefone: formatted })
                          if (erros.telefone) setErros({ ...erros, telefone: '' })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAvancar()
                          }
                        }}
                        autoFocus
                        className="min-h-14 pl-12 text-base font-medium rounded-2xl"
                      />
                    </div>
                    {erros.telefone && (
                      <p className="text-sm font-medium text-destructive">{erros.telefone}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Insira o DDD e seu número. Enviaremos as instruções de acesso e seu voucher
                      pelo WhatsApp.
                    </p>
                  </div>
                )}

                {etapaAtual === 3 && (
                  <div className="space-y-4">
                    <label
                      htmlFor={inputEmailId}
                      className="block text-sm font-semibold text-foreground"
                    >
                      Seu melhor e-mail <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id={inputEmailId}
                        type="email"
                        placeholder="seu.nome@exemplo.com.br"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value })
                          if (erros.email) setErros({ ...erros, email: '' })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAvancar()
                          }
                        }}
                        autoFocus
                        className="min-h-14 pl-12 text-base font-medium rounded-2xl"
                      />
                    </div>
                    {erros.email && (
                      <p className="text-sm font-medium text-destructive">{erros.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enviaremos o comprovante de agendamento e informações institucionais.
                    </p>
                  </div>
                )}

                {etapaAtual === 4 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Selecione seu objetivo principal:
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {OBJETIVOS.map((item) => {
                        const Icon = item.icon
                        const selected = formData.objetivo === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, objetivo: item.id })
                              if (erros.objetivo) setErros({ ...erros, objetivo: '' })
                            }}
                            className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                              selected
                                ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40 shadow-sm'
                                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary/40'
                            }`}
                          >
                            <div
                              className={`mt-0.5 rounded-xl p-2 transition-colors ${
                                selected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-muted-foreground'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-foreground">{item.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {erros.objetivo && (
                      <p className="text-sm font-medium text-destructive">{erros.objetivo}</p>
                    )}
                    {formData.objetivo && VIDEO_POR_OBJETIVO[formData.objetivo] && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                        <div className="aspect-video w-full">
                          <iframe
                            src={`https://drive.google.com/file/d/${VIDEO_POR_OBJETIVO[formData.objetivo]}/preview`}
                            title={`Vídeo — ${formData.objetivo}`}
                            allow="autoplay; encrypted-media; fullscreen"
                            allowFullScreen
                            className="h-full w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {etapaAtual === 5 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Selecione onde você mora ou trabalha:
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {PROXIMIDADES.map((item) => {
                        const selected = formData.proximidade === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, proximidade: item.id })
                              if (erros.proximidade) setErros({ ...erros, proximidade: '' })
                            }}
                            className={`flex items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all ${
                              selected
                                ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40 shadow-sm'
                                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`rounded-xl p-2.5 ${
                                  selected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                <MapPin className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground">{item.title}</p>
                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                              </div>
                            </div>
                            <span className="hidden sm:inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                              {item.tag}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {erros.proximidade && (
                      <p className="text-sm font-medium text-destructive">{erros.proximidade}</p>
                    )}
                  </div>
                )}

                {etapaAtual === 6 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Selecione sua rotina de trabalho/estudos:
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {OCUPACOES.map((item) => {
                        const selected = formData.ocupacao === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              // REF-03 — trocar a rotina limpa a resposta secundária
                              // incompatível (profissão e texto de Outros).
                              setFormData({
                                ...formData,
                                ocupacao: item.id,
                                profissao: '',
                                profissao_outros: '',
                              })
                              if (erros.ocupacao) setErros({ ...erros, ocupacao: '' })
                              if (erros.profissao) setErros({ ...erros, profissao: '' })
                              if (erros.profissao_outros)
                                setErros({ ...erros, profissao_outros: '' })
                            }}
                            className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                              selected
                                ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40 shadow-sm'
                                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary/40'
                            }`}
                          >
                            <p className="text-sm font-bold text-foreground">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                    {erros.ocupacao && (
                      <p className="text-sm font-medium text-destructive">{erros.ocupacao}</p>
                    )}
                    {profissaoAplicavel(formData.ocupacao) && (
                      <div className="mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Qual é a sua profissão? <span className="text-primary">*</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(formData.ocupacao === 'CLT' ? PROFISSOES_CLT : PROFISSOES_AUTONOMO).map(
                            (prof) => {
                              const selected = formData.profissao === prof
                              return (
                                <button
                                  key={prof}
                                  type="button"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      profissao: prof,
                                      profissao_outros: '',
                                    })
                                    if (erros.profissao) setErros({ ...erros, profissao: '' })
                                    if (erros.profissao_outros)
                                      setErros({ ...erros, profissao_outros: '' })
                                  }}
                                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                                    selected
                                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                      : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary/40'
                                  }`}
                                >
                                  {prof}
                                </button>
                              )
                            },
                          )}
                        </div>
                        {formData.profissao === 'Outros' && (
                          <Input
                            value={formData.profissao_outros}
                            onChange={(e) => {
                              setFormData({ ...formData, profissao_outros: e.target.value })
                              if (erros.profissao_outros)
                                setErros({ ...erros, profissao_outros: '' })
                            }}
                            placeholder="Escreva qual é a sua profissão"
                            aria-label="Descreva sua profissão"
                          />
                        )}
                        {erros.profissao && (
                          <p className="text-sm font-medium text-destructive">{erros.profissao}</p>
                        )}
                        {erros.profissao_outros && (
                          <p className="text-sm font-medium text-destructive">
                            {erros.profissao_outros}
                          </p>
                        )}
                      </div>
                    )}
                    {VIDEO_DIFERENCIAIS && (
                      <div className="mt-6 space-y-3">
                        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                          <div className="aspect-video w-full">
                            <iframe
                              src={`https://drive.google.com/file/d/${VIDEO_DIFERENCIAIS}/preview`}
                              title="Conheça o Fellice Fitness"
                              allow="autoplay; encrypted-media; fullscreen"
                              allowFullScreen
                              className="h-full w-full"
                            />
                          </div>
                        </div>
                        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                          <p className="text-sm font-bold text-foreground">
                            Um espaço pensado para elevar sua experiência de treino.
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Estrutura, tecnologia, conforto e possibilidades para cuidar do corpo,
                            superar limites e transformar sua rotina. E tem mais: você ainda pode
                            aproveitar a vista da cidade e correr em uma pista de cooper ao ar
                            livre.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {etapaAtual === 7 && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Qual é o seu interesse imediato? <span className="text-primary">*</span>
                      </p>
                      <div className="grid grid-cols-1 gap-2.5">
                        {INTERESSES.map((item) => {
                          const selected = formData.interesse_em_visita === item.id
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, interesse_em_visita: item.id })
                                if (erros.interesse_em_visita) {
                                  setErros({ ...erros, interesse_em_visita: '' })
                                }
                              }}
                              className={`flex items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all ${
                                selected
                                  ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40 shadow-sm'
                                  : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary/40'
                              }`}
                            >
                              <div>
                                <p className="text-sm font-bold text-foreground">{item.title}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                              </div>
                              {item.highlight && (
                                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                                  Recomendado
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {erros.interesse_em_visita && (
                        <p className="text-sm font-medium text-destructive">
                          {erros.interesse_em_visita}
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-primary/20 bg-secondary/50 p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={formData.precisa_de_ajuda_humana}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              precisa_de_ajuda_humana: checked === true,
                            })
                          }
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-foreground">
                            Quero atendimento humano especializado
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Marque se tiver dúvidas específicas sobre planos, horários de pico ou
                            condições especiais.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-border bg-card/60 p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={formData.consentimento}
                          onCheckedChange={(checked) => {
                            setFormData({
                              ...formData,
                              consentimento: checked === true,
                            })
                            if (erros.consentimento) {
                              setErros({ ...erros, consentimento: '' })
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="space-y-1">
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Autorizo a Fellice Fitness a entrar em contato pelos meios eletrônicos
                            informados (WhatsApp, telefone e e-mail) para enviar minha triagem,
                            avisos e informações da academia.
                          </p>
                        </div>
                      </label>
                      {erros.consentimento && (
                        <p className="mt-2 text-xs font-semibold text-destructive">
                          {erros.consentimento}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {erroEnvio && (
                <div className="mt-6 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
                  {erroEnvio}
                </div>
              )}

              <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                {etapaAtual > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVoltar}
                    disabled={statusEnvio === 'sending'}
                    className="min-h-12 rounded-xl px-5 font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                ) : (
                  <div />
                )}

                <Button
                  type="button"
                  onClick={handleAvancar}
                  disabled={statusEnvio === 'sending'}
                  className="min-h-12 rounded-xl bg-primary px-8 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
                >
                  {statusEnvio === 'sending' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : etapaAtual === 7 ? (
                    <>
                      Concluir
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Seguir
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 text-xs text-muted-foreground">
              <p>
                Terrazzo R1 Sports Club · Rua Rubens Guelli, 68 - Terraço - Itaigara, Salvador - BA,
                41815-135
              </p>
              <div className="flex items-center gap-4">
                <Link to="/agendar" className="font-semibold text-primary hover:underline">
                  Agendamento direto de visita
                </Link>
                <span>·</span>
                <span className="font-medium">Atendimento: (71) 99396-0018</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Index
