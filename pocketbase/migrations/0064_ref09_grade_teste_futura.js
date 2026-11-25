// REF-09 r2 / decisão do consultor Ricardo em 18/11/2026 ("Grade de teste futura"):
// substitui a grade de teste de 0011 (21/09–03/10, datas passadas) por uma grade
// nova em datas futuras, para o sistema ficar navegável no teste do reagendamento.
// Mesma forma da 0011: slot 30 min; seg–sex 08:00–19:30 (último bloco 19:00);
// sáb 09:00–13:30 (último bloco 13:00); sem domingo; capacidade 2 para blocos que
// COMEÇAM entre 11:30 e 16:30, demais 1. 21 dias a partir da próxima segunda-feira.
//
// GRADE REAL é decisão humana do Champion (dias da semana, horários desde 05:30,
// capacidade) — esta migração é FIXTURE DE TESTE, marcada por created_by.
//
// Idempotente: não duplica slot_id existente. Up remove a grade antiga de 0011
// (created_by='grade-teste') — os agendamentos existentes NÃO são tocados (o
// appointment guarda slot_id/slot_datetime próprios). Down remove somente os slots
// criados aqui (created_by='grade-teste-2026-11'); a grade de 0011 não é restaurada
// (fixture de teste, sem valor histórico).

const GRADE_TAG = 'grade-teste-2026-11'

const buildGrid = () => {
  const slots = []
  const today = new Date()
  const day = today.getUTCDay() // 0 dom, 1 seg ... 6 sáb
  const daysUntilMonday = (8 - day) % 7 || 7
  const monday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilMonday),
  )
  for (let d = 0; d < 21; d++) {
    const current = new Date(monday.getTime() + d * 86400000)
    const weekday = current.getUTCDay()
    if (weekday === 0) continue // domingo sem grade
    const startHour = weekday === 6 ? 9 : 8
    const endHour = weekday === 6 ? 13 : 19
    for (let h = startHour; h <= endHour; h++) {
      for (const m of [0, 30]) {
        if (h === endHour && m > 0) continue // último bloco termina :30
        const hh = String(h).padStart(2, '0')
        const mm = String(m).padStart(2, '0')
        const iso = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')} ${hh}:${mm}:00.000Z`
        const startMinutes = h * 60 + m
        const capacity = startMinutes >= 11 * 60 + 30 && startMinutes <= 16 * 60 + 30 ? 2 : 1
        slots.push({
          slot_id: `slot-${iso.slice(0, 10)}-${hh}${mm}`,
          slot_datetime: iso,
          slot_duration_min: 30,
          capacity: capacity,
          status: 'ABERTO',
          created_by: GRADE_TAG,
        })
      }
    }
  }
  return slots
}

migrate(
  (app) => {
    const slots = app.findCollectionByNameOrId('agenda_slots')

    // decisão B: a grade antiga de teste (0011) sai do ar — substituída por esta
    try {
      const antigas = app.findRecordsByFilter(
        'agenda_slots',
        "created_by = 'grade-teste'",
        '-slot_datetime',
        0,
        0,
      )
      antigas.forEach((record) => app.delete(record))
    } catch (_) {}

    const grid = buildGrid()
    grid.forEach((data) => {
      try {
        app.findFirstRecordByData('agenda_slots', 'slot_id', data.slot_id)
      } catch (_) {
        const record = new Record(slots)
        Object.entries(data).forEach(([key, value]) => record.set(key, value))
        app.save(record)
      }
    })
  },
  (app) => {
    // rollback cirúrgico: remove somente os slots gerados por esta migração
    try {
      const records = app.findRecordsByFilter(
        'agenda_slots',
        "created_by = 'grade-teste-2026-11'",
        '-slot_datetime',
        0,
        0,
      )
      records.forEach((record) => app.delete(record))
    } catch (_) {}
  },
)
