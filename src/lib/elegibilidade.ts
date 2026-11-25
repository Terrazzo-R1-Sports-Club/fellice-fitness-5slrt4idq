// REF-06 / SPEC-4-004 (CA-4-R06) — matriz de elegibilidade por perfil, versão v1.
//
// Insumos aprovados pelo consultor em 06/11/2026 (04_fase-atual/ref06-insumos.md):
// 1. Por respostas individuais. DESQUALIFICAM:
//    - proximidade "Moro/trabalho em outra região, mas me desloco para treinar"
//    - proximidade "Ainda não conheço bem a região"
//    - profissão (CLT): Assistente administrativo, Vendedor, Técnico de enfermagem
//    - profissão (Autônomo): Cabeleireiro, Eletricista
//    Todas as outras respostas qualificam.
// 2. Resposta ausente (quando deveria existir) → atendimento humano (não decide sozinha).
// 3. Ajuda humana é exceção: quem pediu atendimento humano não é bloqueado pela matriz.
// 4. Ocupações sem pergunta de profissão (Empresário, Estudante, Aposentado,
//    Diretor ou alta gerência, Prefiro não informar) qualificam direto (decisão do
//    consultor em 06/11/2026 — profissão não se aplica a elas).
// 5. O score da REF-05 NÃO participa da elegibilidade (só ordena a Fila).
//
// Resultado determinístico: QUALIFICADO | NAO_QUALIFICADO | AUSENTE.
// AUSENTE e NAO_QUALIFICADO seguem para atendimento humano (motivos distintos).

export type ElegibilidadeVeredito = 'QUALIFICADO' | 'NAO_QUALIFICADO' | 'AUSENTE'

export interface ResultadoElegibilidade {
  veredito: ElegibilidadeVeredito
  motivo: string
}

// Ocupações que não abrem a pergunta de profissão: qualificam direto (insumo 4 do
// detalhamento, decisão do consultor). CLT e Autônomo exigem profissão não desqualificante.
const OCUPACOES_SEM_PROFISSAO = [
  'Empresário',
  'Estudante',
  'Aposentado',
  'Diretor ou alta gerência',
  'Prefiro não informar',
]

const PROXIMIDADES_DESQUALIFICANTES = [
  'Moro/trabalho em outra região, mas me desloco para treinar',
  'Ainda não conheço bem a região',
]

const PROFISSOES_DESQUALIFICANTES = [
  'Assistente administrativo',
  'Vendedor',
  'Técnico de enfermagem',
  'Cabeleireiro',
  'Eletricista',
]

export function avaliarElegibilidade(
  proximidade: string | undefined,
  ocupacao: string | undefined,
  profissao: string | undefined,
): ResultadoElegibilidade {
  const prox = (proximidade ?? '').trim()
  const ocup = (ocupacao ?? '').trim()
  const prof = (profissao ?? '').trim()

  if (!prox || !ocup) {
    return {
      veredito: 'AUSENTE',
      motivo: 'DADOS_AUSENTES: proximidade ou rotina sem resposta',
    }
  }

  if (PROXIMIDADES_DESQUALIFICANTES.includes(prox)) {
    return {
      veredito: 'NAO_QUALIFICADO',
      motivo: `PERFIL_NAO_QUALIFICADO: proximidade "${prox}"`,
    }
  }

  if (OCUPACOES_SEM_PROFISSAO.includes(ocup)) {
    // profissão não se aplica a esta ocupação — qualifica direto
    return { veredito: 'QUALIFICADO', motivo: `PERFIL_QUALIFICADO: rotina "${ocup}"` }
  }

  if (ocup === 'CLT' || ocup === 'Autônomo') {
    if (!prof) {
      return {
        veredito: 'AUSENTE',
        motivo: 'DADOS_AUSENTES: profissão sem resposta',
      }
    }
    if (PROFISSOES_DESQUALIFICANTES.includes(prof)) {
      return {
        veredito: 'NAO_QUALIFICADO',
        motivo: `PERFIL_NAO_QUALIFICADO: profissão "${prof}"`,
      }
    }
    return { veredito: 'QUALIFICADO', motivo: `PERFIL_QUALIFICADO: profissão "${prof}"` }
  }

  // ocupação fora das listas conhecidas (ex.: valor antigo de versão anterior do
  // formulário): sem profissão aplicável, não há resposta a avaliar → ausente
  return {
    veredito: 'AUSENTE',
    motivo: `DADOS_AUSENTES: rotina "${ocup}" fora das opções atuais`,
  }
}

export const ELEGIBILIDADE_MATRIZ = 'v1'
