// F2-IMP-007 — DEBUG: hook de defesa em profundidade para a assunção (CA-2.07/CA-2.09).
// Regras aplicadas no servidor em QUALQUER update de lead_appointments:
// 1. Assunção (dono sendo definido) só vale para ENCAMINHAMENTO_HUMANO sem dono —
//    caso já assumido é recusado (400), sem mudança de estado.
// 2. assumed_at é gravado pelo SERVIDOR (não confia no cliente).
// 3. Troca de dono sem reatribuição formal (F2-IMP-008) e limpeza de dono são recusadas.
// A validação de PAPEL (champion/consultor) é feita pelas regras da coleção (updateRule);
// este hook cobre a consistência da assunção em qualquer canal (API, página, migração).
// Toda a lógica INLINE (JSVM não compartilha escopo de topo — guardrail do Skip).

onRecordUpdate((e) => {
  const rec = e.record
  const orig = rec.original()
  const origStatus = orig.getString('status', '')
  const origDono = orig.getString('dono', '')
  const newDono = rec.getString('dono', '')

  // assunção: dono novo em registro sem dono
  if (newDono && !origDono) {
    if (origStatus !== 'ENCAMINHAMENTO_HUMANO') {
      throw new BadRequestError('Somente tentativas em ENCAMINHAMENTO_HUMANO podem ser assumidas.')
    }
    // assumed_at é do servidor
    rec.set('assumed_at', new Date().toISOString())
  }

  // caso já assumido: troca de dono sem reatribuição formal é recusada
  if (origDono && newDono && newDono !== origDono) {
    throw new BadRequestError('Caso já assumido — a reatribuição é feita pela Gestão (F2-IMP-008).')
  }

  // limpeza de dono sem reatribuição formal é recusada
  if (origDono && !newDono) {
    throw new BadRequestError('O dono não pode ser removido sem reatribuição formal (F2-IMP-008).')
  }

  e.next()
}, 'lead_appointments')
