// F2-IMP-004 — DEBUG round 2: fechadura de capacidade NO SERVIDOR (RN-2.01/CA-2.02).
//
// Falha do reteste humano: a página escondia slot cheio, mas o contador
// (agenda_slot_occupancy) não era atualizado por nenhuma camada e o servidor
// aceitava reservas acima da capacidade via API direta.
//
// Este hook roda em QUALQUER salvamento de lead_appointments (API pública, página,
// migração): antes de gravar, conta as reservas ativas (CONCLUIDO + TENTATIVA) já
// existentes no slot; se o slot já está cheio, rejeita com BadRequestError (HTTP 400).
// Após gravar, mantém agenda_slot_occupancy sincronizada com a contagem real.
//
// Exceções: slot vazio (fallback humano RN-2.05), DESISTENCIA e ENCAMINHAMENTO_HUMANO
// não ocupam vaga; a própria reserva já ativa no mesmo slot não conta duas vezes
// (reescolha RN-2.06 e transição TENTATIVA → CONCLUIDO).

const ACTIVE = { CONCLUIDO: true, TENTATIVA: true }

const capacityOf = (slotId) => {
  try {
    const slot = $app.findFirstRecordByData('agenda_slots', 'slot_id', slotId)
    return Number(slot.get('capacity') ?? 1) || 1
  } catch (_) {
    return 1
  }
}

// contagem de reservas ativas no slot, excluindo a própria reserva (quando ela já estava ativa)
const activeCountForSlot = (slotId, excludeAppointmentId) => {
  if (!slotId) return 0
  let rows = []
  try {
    rows = $app.findRecordsByFilter(
      'lead_appointments',
      "slot_id = {:slot} && (status = 'CONCLUIDO' || status = 'TENTATIVA')",
      '',
      0,
      0,
      { slot: slotId },
    )
  } catch (_) {
    return 0
  }
  let n = 0
  for (const r of rows) {
    if (excludeAppointmentId && r.getString('appointment_id') === excludeAppointmentId) continue
    n++
  }
  return n
}

// mantém agenda_slot_occupancy = contagem real (cria o registro se não existir)
const syncOccupancy = (slotId) => {
  if (!slotId) return
  let row = null
  try {
    row = $app.findFirstRecordByData('agenda_slot_occupancy', 'slot_id', slotId)
  } catch (_) {
    row = null
  }
  const active = activeCountForSlot(slotId, '')
  if (row) {
    row.set('active', active)
    $app.save(row)
  } else {
    const record = new Record($app.findCollectionByNameOrId('agenda_slot_occupancy'))
    record.set('slot_id', slotId)
    record.set('capacity', capacityOf(slotId))
    record.set('active', active)
    $app.save(record)
  }
}

// CREATE: reserva nova (TENTATIVA ou CONCLUIDO direto, como a página /agendar faz)
onRecordCreate((e) => {
  const rec = e.record
  const status = rec.getString('status', '')
  const slotId = rec.getString('slot_id', '')
  let syncAfter = ''
  if (ACTIVE[status] && slotId) {
    const already = activeCountForSlot(slotId, rec.getString('appointment_id', ''))
    if (already >= capacityOf(slotId)) {
      throw new BadRequestError('Este horário acabou de encher. Escolha outro, por favor.')
    }
    syncAfter = slotId
  }
  e.next()
  if (syncAfter) syncOccupancy(syncAfter)
}, 'lead_appointments')

// UPDATE: conclusão (TENTATIVA → CONCLUIDO), reescolha de slot (RN-2.06) e desistência
onRecordUpdate((e) => {
  const rec = e.record
  const orig = rec.original()
  const status = rec.getString('status', '')
  const origStatus = orig.getString('status', '')
  const slotId = rec.getString('slot_id', '')
  const origSlot = orig.getString('slot_id', '')
  const wasActive = !!ACTIVE[origStatus]
  const isActive = !!ACTIVE[status]
  let syncNew = ''
  let syncOld = ''
  // tornando-se ativa num slot onde ainda não estava ativa → valida capacidade
  if (isActive && slotId && !(wasActive && slotId === origSlot)) {
    const already = activeCountForSlot(slotId, rec.getString('appointment_id', ''))
    if (already >= capacityOf(slotId)) {
      throw new BadRequestError('Este horário acabou de encher. Escolha outro, por favor.')
    }
    syncNew = slotId
  }
  // saiu de um slot onde estava ativa (reescolha) ou desativou o estado (desistência)
  if (wasActive && origSlot && (origSlot !== slotId || !isActive)) {
    syncOld = origSlot
  }
  e.next()
  if (syncNew) syncOccupancy(syncNew)
  if (syncOld) syncOccupancy(syncOld)
}, 'lead_appointments')

// DELETE: remoção de reserva libera a vaga
onRecordDelete((e) => {
  const rec = e.record
  const slotId = rec.getString('slot_id', '')
  const wasActive = !!ACTIVE[rec.getString('status', '')]
  e.next()
  if (wasActive && slotId) syncOccupancy(slotId)
}, 'lead_appointments')
