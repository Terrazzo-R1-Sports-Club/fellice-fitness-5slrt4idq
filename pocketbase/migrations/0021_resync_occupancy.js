// F2-IMP-004 — DEBUG round 2: ressincronização completa da ocupação + limpeza das provas.
// O hook de capacidade só sincroniza agenda_slot_occupancy em novas escritas; registros
// criados ANTES do hook (reteste humano e provas r2) ficaram com contador defasado.
// Esta migração: (1) remove as reservas de prova r2; (2) recalcula a ocupação de TODOS
// os slots a partir das reservas ativas reais.

migrate(
  (app) => {
    // 1. remove as reservas de prova r2 (deleteRule null impede via API — correto)
    const proofIds = [
      'appt-prova-r2-1630-a',
      'appt-prova-r2-1630-b',
      'appt-prova-r2-1630-c',
      'appt-prova-r2-1630-d',
      'appt-prova-r2-bloqueio',
      'appt-prova-r2-cap2-ok',
      'appt-prova-r2-cap2-3a',
    ]
    proofIds.forEach((id) => {
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', id))
      } catch (_) {}
    })

    // 2. ressincroniza a ocupação de todos os slots com a contagem real
    const appointments = app.findRecordsByFilter('lead_appointments', '', '-created_at', 0, 0)
    const activeBySlot = {}
    for (const appt of appointments) {
      const slotId = appt.get('slot_id')
      if (!slotId) continue
      const status = appt.get('status')
      if (status === 'CONCLUIDO' || status === 'TENTATIVA') {
        activeBySlot[slotId] = (activeBySlot[slotId] || 0) + 1
      }
    }
    const occupancy = app.findRecordsByFilter('agenda_slot_occupancy', '', '', 0, 0)
    for (const row of occupancy) {
      const slotId = row.get('slot_id')
      const real = activeBySlot[slotId] ?? 0
      if (row.get('active') !== real) {
        row.set('active', real)
        app.save(row)
      }
    }
  },
  (app) => {
    // down: sem restauração — registros de prova
  },
)
