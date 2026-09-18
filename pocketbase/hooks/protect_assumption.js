// F2-IMP-007/008 — defesa de consistência para dono.
// A rota atômica usa queue_operation; PATCH direto é bloqueado pelos hooks
// protect_queue_update/protect_queue_create e pelas regras da coleção.

onRecordUpdate((e) => {
  const rec = e.record
  const orig = rec.original()
  const operation = rec.getString('queue_operation', '')
  const formalReassignment = operation === 'REASSIGN'
  const origStatus = orig.getString('status', '')
  const origDono = orig.getString('dono', '')
  const newDono = rec.getString('dono', '')

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
