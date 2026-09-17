// F2-IMP-004 — DEBUG round 2: fechadura de capacidade NO SERVIDOR (RN-2.01/CA-2.02).
//
// Falha do reteste humano: a página escondia slot cheio, mas o contador
// (agenda_slot_occupancy) não era atualizado por nenhuma camada e o servidor
// aceitava reservas acima da capacidade via API direta.
//
// Hooks que rodam em QUALQUER salvamento de lead_appointments (API pública, página,
// migração): antes de gravar, contam as reservas ativas (CONCLUIDO + TENTATIVA) já
// existentes no slot; se o slot já está cheio, rejeitam com BadRequestError (HTTP 400).
// Após gravar, mantêm agenda_slot_occupancy sincronizada com a contagem real.
//
// IMPORTANTE (JSVM): callbacks executam em pool separado — toda a lógica é INLINE
// em cada callback, sem referências a declarações de topo.
//
// Exceções: slot vazio (fallback humano RN-2.05), DESISTENCIA e ENCAMINHAMENTO_HUMANO
// não ocupam vaga; a própria reserva já ativa no mesmo slot não conta duas vezes
// (reescolha RN-2.06 e transição TENTATIVA → CONCLUIDO).

// CREATE: reserva nova (TENTATIVA ou CONCLUIDO direto, como a página /agendar faz)
// F2-IMP-006: copia o contexto da triagem (lead_submissions, superuser-only) para o
// appointment — a visão operacional mostra o contexto sem expor a coleção protegida.
onRecordCreate((e) => {
  const rec = e.record
  const status = rec.getString('status', '')
  const slotId = rec.getString('slot_id', '')
  const ACTIVE = { CONCLUIDO: true, TENTATIVA: true }
  // contexto da triagem (se o lead veio da triagem da Fase 1)
  try {
    const subId = rec.getString('lead_submission_id', '')
    if (subId) {
      const sub = $app.findFirstRecordByFilter('lead_submissions', 'lead_submission_id = {:id}', {
        id: subId,
      })
      if (sub) {
        rec.set('objetivo', sub.getString('objetivo', ''))
        rec.set('proximidade', sub.getString('proximidade', ''))
        rec.set('ocupacao', sub.getString('ocupacao', ''))
        rec.set('interesse_em_visita', sub.getString('interesse_em_visita', ''))
        rec.set('utm_source', sub.getString('utm_source', ''))
        rec.set('utm_medium', sub.getString('utm_medium', ''))
        rec.set('utm_campaign', sub.getString('utm_campaign', ''))
        rec.set('attribution_status', sub.getString('attribution_status', ''))
      }
    }
  } catch (_) {}
  let syncAfter = ''
  if (ACTIVE[status] && slotId) {
    // capacidade do slot
    let capacity = 1
    try {
      capacity =
        Number(
          $app.findFirstRecordByData('agenda_slots', 'slot_id', slotId).get('capacity') ?? 1,
        ) || 1
    } catch (_) {}
    // reservas ativas já existentes no slot (excluindo a própria, se já estava ativa)
    let already = 0
    try {
      const rows = $app.findRecordsByFilter(
        'lead_appointments',
        "slot_id = {:slot} && (status = 'CONCLUIDO' || status = 'TENTATIVA')",
        '',
        0,
        0,
        { slot: slotId },
      )
      const selfId = rec.getString('appointment_id', '')
      for (const r of rows) {
        if (selfId && r.getString('appointment_id') === selfId) continue
        already++
      }
    } catch (_) {}
    if (already >= capacity) {
      throw new BadRequestError('Este horário acabou de encher. Escolha outro, por favor.')
    }
    syncAfter = slotId
  }
  e.next()
  if (syncAfter) {
    // sincroniza agenda_slot_occupancy com a contagem real
    try {
      let active = 0
      const rows = $app.findRecordsByFilter(
        'lead_appointments',
        "slot_id = {:slot} && (status = 'CONCLUIDO' || status = 'TENTATIVA')",
        '',
        0,
        0,
        { slot: syncAfter },
      )
      active = rows.length
      let row = null
      try {
        row = $app.findFirstRecordByData('agenda_slot_occupancy', 'slot_id', syncAfter)
      } catch (_) {}
      if (row) {
        row.set('active', active)
        $app.save(row)
      } else {
        let capacity = 1
        try {
          capacity =
            Number(
              $app.findFirstRecordByData('agenda_slots', 'slot_id', syncAfter).get('capacity') ?? 1,
            ) || 1
        } catch (_) {}
        const record = new Record($app.findCollectionByNameOrId('agenda_slot_occupancy'))
        record.set('slot_id', syncAfter)
        record.set('capacity', capacity)
        record.set('active', active)
        $app.save(record)
      }
    } catch (err) {
      $app.logger().error('occupancy sync falhou (create)', 'slot', syncAfter, 'error', String(err))
    }
  }
}, 'lead_appointments')

// UPDATE: conclusão (TENTATIVA → CONCLUIDO), reescolha de slot (RN-2.06) e desistência
onRecordUpdate((e) => {
  const rec = e.record
  const orig = rec.original()
  const status = rec.getString('status', '')
  const origStatus = orig.getString('status', '')
  const slotId = rec.getString('slot_id', '')
  const origSlot = orig.getString('slot_id', '')
  const ACTIVE = { CONCLUIDO: true, TENTATIVA: true }
  const wasActive = !!ACTIVE[origStatus]
  const isActive = !!ACTIVE[status]
  const syncNew = isActive && slotId && !(wasActive && slotId === origSlot) ? slotId : ''
  const syncOld = wasActive && origSlot && (origSlot !== slotId || !isActive) ? origSlot : ''
  // tornando-se ativa num slot onde ainda não estava ativa → valida capacidade
  if (syncNew) {
    let capacity = 1
    try {
      capacity =
        Number(
          $app.findFirstRecordByData('agenda_slots', 'slot_id', slotId).get('capacity') ?? 1,
        ) || 1
    } catch (_) {}
    let already = 0
    try {
      const rows = $app.findRecordsByFilter(
        'lead_appointments',
        "slot_id = {:slot} && (status = 'CONCLUIDO' || status = 'TENTATIVA')",
        '',
        0,
        0,
        { slot: slotId },
      )
      const selfId = rec.getString('appointment_id', '')
      for (const r of rows) {
        if (selfId && r.getString('appointment_id') === selfId) continue
        already++
      }
    } catch (_) {}
    if (already >= capacity) {
      throw new BadRequestError('Este horário acabou de encher. Escolha outro, por favor.')
    }
  }
  e.next()
  const syncOne = (target) => {
    try {
      let active = 0
      const rows = $app.findRecordsByFilter(
        'lead_appointments',
        "slot_id = {:slot} && (status = 'CONCLUIDO' || status = 'TENTATIVA')",
        '',
        0,
        0,
        { slot: target },
      )
      active = rows.length
      let row = null
      try {
        row = $app.findFirstRecordByData('agenda_slot_occupancy', 'slot_id', target)
      } catch (_) {}
      if (row) {
        row.set('active', active)
        $app.save(row)
      } else {
        let capacity = 1
        try {
          capacity =
            Number(
              $app.findFirstRecordByData('agenda_slots', 'slot_id', target).get('capacity') ?? 1,
            ) || 1
        } catch (_) {}
        const record = new Record($app.findCollectionByNameOrId('agenda_slot_occupancy'))
        record.set('slot_id', target)
        record.set('capacity', capacity)
        record.set('active', active)
        $app.save(record)
      }
    } catch (err) {
      $app.logger().error('occupancy sync falhou (update)', 'slot', target, 'error', String(err))
    }
  }
  if (syncNew) syncOne(syncNew)
  if (syncOld) syncOne(syncOld)
}, 'lead_appointments')

// DELETE: remoção de reserva libera a vaga
onRecordDelete((e) => {
  const rec = e.record
  const slotId = rec.getString('slot_id', '')
  const ACTIVE = { CONCLUIDO: true, TENTATIVA: true }
  const wasActive = !!ACTIVE[rec.getString('status', '')]
  e.next()
  if (wasActive && slotId) {
    try {
      let active = 0
      const rows = $app.findRecordsByFilter(
        'lead_appointments',
        "slot_id = {:slot} && (status = 'CONCLUIDO' || status = 'TENTATIVA')",
        '',
        0,
        0,
        { slot: slotId },
      )
      active = rows.length
      let row = null
      try {
        row = $app.findFirstRecordByData('agenda_slot_occupancy', 'slot_id', slotId)
      } catch (_) {}
      if (row) {
        row.set('active', active)
        $app.save(row)
      } else {
        let capacity = 1
        try {
          capacity =
            Number(
              $app.findFirstRecordByData('agenda_slots', 'slot_id', slotId).get('capacity') ?? 1,
            ) || 1
        } catch (_) {}
        const record = new Record($app.findCollectionByNameOrId('agenda_slot_occupancy'))
        record.set('slot_id', slotId)
        record.set('capacity', capacity)
        record.set('active', active)
        $app.save(record)
      }
    } catch (err) {
      $app.logger().error('occupancy sync falhou (delete)', 'slot', slotId, 'error', String(err))
    }
  }
}, 'lead_appointments')
