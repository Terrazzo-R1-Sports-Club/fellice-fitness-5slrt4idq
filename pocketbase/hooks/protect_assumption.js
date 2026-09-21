// F2-IMP-007/008 — defesa de consistência para dono.
// A rota atômica usa queue_operation; PATCH direto é bloqueado pelos hooks
// protect_queue_update/protect_queue_create e pelas regras da coleção.

onRecordUpdate((e) => {
  const rec = e.record
  const orig = rec.original()
  const operation = rec.getString('queue_operation', '')
  const origStatus = orig.getString('status', '')
  const origDono = orig.getString('dono', '')
  const newDono = rec.getString('dono', '')
  // DEBUG r1 (2026-09-21): a flag formal (queue_operation, campo oculto) não ficou
  // visível ao hook de modelo durante o save da rota atômica no JSVM — a reatribuição
  // formal era bloqueada como troca direta de dono. A rota também deixa a impressão
  // digital da operação em responsavel_anterior = dono anterior (campo visível, e
  // blindado contra PATCH pela protect_queue_update), reconhecida aqui como formal.
  const formalReassignment =
    operation === 'REASSIGN' ||
    (origDono !== '' &&
      newDono !== '' &&
      newDono !== origDono &&
      rec.getString('responsavel_anterior', '') === origDono)

  if (newDono && !origDono) {
    if (origStatus !== 'ENCAMINHAMENTO_HUMANO') {
      throw new BadRequestError('Somente tentativas em ENCAMINHAMENTO_HUMANO podem ser assumidas.')
    }
    if (!rec.getString('assumed_at', '')) rec.set('assumed_at', new Date().toISOString())
  }

  if (origDono && newDono && newDono !== origDono && !formalReassignment) {
    throw new BadRequestError(
      'Caso já assumido — a reatribuição deve usar a ação formal da Gestão.',
    )
  }

  if (origDono && !newDono && !formalReassignment) {
    throw new BadRequestError('O dono não pode ser removido sem reatribuição formal.')
  }

  e.next()
}, 'lead_appointments')
