// REF-06 / SPEC-4-004 (CA-4-R06) — gate de elegibilidade por perfil NO SERVIDOR.
//
// "Apenas esconder botão não comprova bloqueio" (regra da SPEC): qualquer POST/PATCH
// direto à API de lead_appointments que efetive reserva ativa (TENTATIVA ou CONCLUIDO)
// é avaliado aqui contra a matriz de perfil v1 — espelho inline de
// src/lib/elegibilidade.ts (o JSVM não compartilha escopo entre arquivos).
//
// Regras aprovadas pelo consultor em 06/11/2026 (04_fase-atual/ref06-insumos.md):
// - DESQUALIFICAM: proximidade "Moro/trabalho em outra região, mas me desloco para
//   treinar" e "Ainda não conheço bem a região"; profissões Assistente administrativo,
//   Vendedor, Técnico de enfermagem (CLT), Cabeleireiro e Eletricista (Autônomo).
// - Resposta ausente → atendimento humano (não decide sozinha; não qualifica).
// - Ajuda humana é exceção: precisa_de_ajuda_humana = true na triagem → passa.
// - Ocupações sem pergunta de profissão (Empresário, Estudante, Aposentado,
//   "Diretor ou alta gerência", "Prefiro não informar") qualificam direto.
// - O score da REF-05 NÃO participa da elegibilidade.
// - ENCAMINHAMENTO_HUMANO e DESISTENCIA nunca são bloqueados.
// - Operador autenticado (champion/gestão/supervisora/consultor) passa: a matriz governa
//   o fluxo público do lead, não o trabalho humano autorizado (updateRule da coleção).
//
// IMPORTANTE (guia de hooks): superusuário passa ANTES de qualquer checagem de app —
// um gate que bloqueie o painel trava logs, migrações e o próprio deploy que o corrigiria.

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  if (e.auth) return e.next()
  const body = e.requestInfo().body || {}
  const status = String(body.status || '')
  if (status !== 'TENTATIVA' && status !== 'CONCLUIDO') return e.next()
  const subId = String(body.lead_submission_id || '')
  if (!subId) {
    throw new BadRequestError(
      'Agendamento online exige a triagem concluída. Faça a triagem ou peça atendimento humano.',
    )
  }
  let sub = null
  try {
    sub = $app.findFirstRecordByFilter('lead_submissions', 'lead_submission_id = {:id}', {
      id: subId,
    })
  } catch (_) {}
  if (!sub) {
    throw new BadRequestError(
      'Não encontramos a triagem deste atendimento. Refaça a triagem ou peça atendimento humano.',
    )
  }
  // matriz v1 inline — espelho de src/lib/elegibilidade.ts (avaliarElegibilidade)
  const prox = String(sub.getString('proximidade', '') || '').trim()
  const ocup = String(sub.getString('ocupacao', '') || '').trim()
  const prof = String(sub.getString('profissao', '') || '').trim()
  const ajuda = sub.getBool('precisa_de_ajuda_humana', false)
  if (ajuda) return e.next()
  const OCUPACOES_SEM_PROFISSAO = [
    'Empresário',
    'Estudante',
    'Aposentado',
    'Diretor ou alta gerência',
    'Prefiro não informar',
  ]
  const PROX_DESQUALIFICANTES = [
    'Moro/trabalho em outra região, mas me desloco para treinar',
    'Ainda não conheço bem a região',
  ]
  const PROF_DESQUALIFICANTES = [
    'Assistente administrativo',
    'Vendedor',
    'Técnico de enfermagem',
    'Cabeleireiro',
    'Eletricista',
  ]
  let veredito = 'AUSENTE'
  if (!prox || !ocup) {
    veredito = 'AUSENTE'
  } else if (PROX_DESQUALIFICANTES.indexOf(prox) !== -1) {
    veredito = 'NAO_QUALIFICADO'
  } else if (OCUPACOES_SEM_PROFISSAO.indexOf(ocup) !== -1) {
    veredito = 'QUALIFICADO'
  } else if (ocup === 'CLT' || ocup === 'Autônomo') {
    if (!prof) {
      veredito = 'AUSENTE'
    } else if (PROF_DESQUALIFICANTES.indexOf(prof) !== -1) {
      veredito = 'NAO_QUALIFICADO'
    } else {
      veredito = 'QUALIFICADO'
    }
  } else {
    veredito = 'AUSENTE'
  }
  if (veredito !== 'QUALIFICADO') {
    $app.logger().warn('ref06_gate_bloqueio', 'veredito', veredito, 'submission', subId)
    throw new BadRequestError(
      'Agendamento online não disponível para este perfil. Nossa equipe vai entrar em contato para ajudar você.',
    )
  }
  e.next()
}, 'lead_appointments')

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  if (e.auth) return e.next()
  const body = e.requestInfo().body || {}
  const status = String(body.status || e.record.getString('status', ''))
  if (status !== 'TENTATIVA' && status !== 'CONCLUIDO') return e.next()
  const subId = String(body.lead_submission_id || e.record.getString('lead_submission_id', ''))
  if (!subId) {
    throw new BadRequestError(
      'Agendamento online exige a triagem concluída. Faça a triagem ou peça atendimento humano.',
    )
  }
  let sub = null
  try {
    sub = $app.findFirstRecordByFilter('lead_submissions', 'lead_submission_id = {:id}', {
      id: subId,
    })
  } catch (_) {}
  if (!sub) {
    throw new BadRequestError(
      'Não encontramos a triagem deste atendimento. Refaça a triagem ou peça atendimento humano.',
    )
  }
  const prox = String(sub.getString('proximidade', '') || '').trim()
  const ocup = String(sub.getString('ocupacao', '') || '').trim()
  const prof = String(sub.getString('profissao', '') || '').trim()
  const ajuda = sub.getBool('precisa_de_ajuda_humana', false)
  if (ajuda) return e.next()
  const OCUPACOES_SEM_PROFISSAO = [
    'Empresário',
    'Estudante',
    'Aposentado',
    'Diretor ou alta gerência',
    'Prefiro não informar',
  ]
  const PROX_DESQUALIFICANTES = [
    'Moro/trabalho em outra região, mas me desloco para treinar',
    'Ainda não conheço bem a região',
  ]
  const PROF_DESQUALIFICANTES = [
    'Assistente administrativo',
    'Vendedor',
    'Técnico de enfermagem',
    'Cabeleireiro',
    'Eletricista',
  ]
  let veredito = 'AUSENTE'
  if (!prox || !ocup) {
    veredito = 'AUSENTE'
  } else if (PROX_DESQUALIFICANTES.indexOf(prox) !== -1) {
    veredito = 'NAO_QUALIFICADO'
  } else if (OCUPACOES_SEM_PROFISSAO.indexOf(ocup) !== -1) {
    veredito = 'QUALIFICADO'
  } else if (ocup === 'CLT' || ocup === 'Autônomo') {
    if (!prof) {
      veredito = 'AUSENTE'
    } else if (PROF_DESQUALIFICANTES.indexOf(prof) !== -1) {
      veredito = 'NAO_QUALIFICADO'
    } else {
      veredito = 'QUALIFICADO'
    }
  } else {
    veredito = 'AUSENTE'
  }
  if (veredito !== 'QUALIFICADO') {
    $app.logger().warn('ref06_gate_bloqueio', 'veredito', veredito, 'submission', subId)
    throw new BadRequestError(
      'Agendamento online não disponível para este perfil. Nossa equipe vai entrar em contato para ajudar você.',
    )
  }
  e.next()
}, 'lead_appointments')
