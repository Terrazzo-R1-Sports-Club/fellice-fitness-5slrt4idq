// REF-05 / SPEC-4-004 — matriz de pontuação v1, aprovada pela cliente em 06/11/2026.
// Escala 0–10. O peso da profissão (quando informada) SUBSTITUI o peso da ocupação.
// Faixas: Alta = nota >= 7; Baixa = nota <= 5; entre eles, Média (6).
// Resposta ausente/inválida = nota 0 → Baixa, exibida como "Sem pontuação"
// (nunca nota favorável inventada — regra da SPEC).
// Cálculo determinístico: mesmas respostas produzem sempre a mesma nota.
// Mudar pesos no futuro = nova versão da matriz (v2, v3...), nunca editar v1.

export const MATRIZ_VERSAO = 'v1'

export const PESOS_OCUPACAO: Record<string, number> = {
  CLT: 5,
  Autônomo: 6,
  Empresário: 7,
  'Diretor ou alta gerência': 9,
  Estudante: 7,
  Aposentado: 7,
  'Prefiro não informar': 5,
}

export const PESOS_PROFISSAO: Record<string, number> = {
  // CLT (ocupação = 5)
  'Assistente administrativo': 5,
  Vendedor: 4,
  'Técnico de enfermagem': 5,
  Médico: 8,
  Engenheiro: 8,
  // Autônomo (ocupação = 6)
  Cabeleireiro: 5,
  Eletricista: 4,
  Advogado: 8,
  Dentista: 7,
  // "Outros" (texto livre) tem peso fixo por ocupação
  'Outros: CLT': 6,
  'Outros: Autônomo': 6,
}

export const FAIXA_ALTA_MIN = 7
export const FAIXA_BAIXA_MAX = 5

export type Prioridade = {
  nota: number
  faixa: 'alta' | 'media' | 'baixa' | 'sem_pontuacao'
  matriz: string
  motivo: string
}

export const SEM_PONTUACAO: Prioridade = {
  nota: 0,
  faixa: 'sem_pontuacao',
  matriz: MATRIZ_VERSAO,
  motivo: 'sem resposta de rotina',
}

export function calcularPrioridade(
  ocupacao: string | null | undefined,
  profissao?: string | null | undefined,
): Prioridade {
  const ocupacaoLimpa = (ocupacao ?? '').trim()
  if (!ocupacaoLimpa) return SEM_PONTUACAO

  let nota = PESOS_OCUPACAO[ocupacaoLimpa]
  let motivo = `ocupacao: ${ocupacaoLimpa}`

  const profissaoLimpa = (profissao ?? '').trim()
  if (profissaoLimpa) {
    const pesoProfissao = profissaoLimpa.startsWith('Outros:')
      ? PESOS_PROFISSAO[`Outros: ${ocupacaoLimpa}`]
      : PESOS_PROFISSAO[profissaoLimpa]
    if (pesoProfissao !== undefined) {
      nota = pesoProfissao
      motivo = `profissao: ${profissaoLimpa}`
    }
  }

  if (nota === undefined) return SEM_PONTUACAO

  const faixa = nota >= FAIXA_ALTA_MIN ? 'alta' : nota <= FAIXA_BAIXA_MAX ? 'baixa' : 'media'

  return { nota, faixa, matriz: MATRIZ_VERSAO, motivo }
}

export function rotuloPrioridade(p: Prioridade | null | undefined): string {
  if (!p || p.faixa === 'sem_pontuacao') return 'Sem pontuação'
  return `${p.faixa === 'alta' ? 'Alta' : p.faixa === 'media' ? 'Média' : 'Baixa'} · ${p.nota}`
}
