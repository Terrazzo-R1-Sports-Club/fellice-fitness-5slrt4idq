// T01 (Fase 5) / insumos do Champion registrados em 04_fase-atual/t01-insumos.md
// (grade REAL v1.1, coletada via operador Ricardo em 23/11/2026 15:50–15:57):
//
//   - Dias: segunda a sexta. Sábado e domingo SOMENTE em urgência (exceção
//     humana, tratada pela equipe — a grade publica somente dias úteis).
//     Feriado sem disponibilidade (regra operacional humana).
//   - Inícios de 30 em 30 minutos; primeiro horário 07:00; último horário de
//     início 19:30 — 19:30 é horário válido de início (atendimento até 20:00).
//   - Capacidade por slot (30 min): 07:00–11:00 → 1; 11:00–17:00 → 2;
//     17:00–20:00 → 1. Ou seja: inícios 07:00–10:30 (8 slots, cap 1),
//     11:00–16:30 (12 slots, cap 2), 17:00–19:30 (6 slots, cap 1)
//     = 26 slots/dia útil.
//   - Duração: 30 minutos (mantida da grade de teste).
//
// Substitui a grade de teste futura da 0064 (23/11–12/12, created_by
// 'grade-teste-2026-11'): os slots de teste SAEM DO AR e a grade REAL entra.
// Agendamentos existentes NÃO são tocados (o appointment guarda slot_id/
// slot_datetime próprios). A janela da grade REAL cobre 4 semanas a partir da
// próxima segunda-feira (28 dias), para o sistema ficar navegável na regressão
// da T01 e no teste humano; a renovação da janela é operação de manutenção
// posterior (decisão humana).
//
// Idempotente: não duplica slot_id existente. Up remove os slots de teste
// (created_by='grade-teste-2026-11') antes de criar a grade REAL. Down remove
// somente os slots criados aqui (created_by='grade-real-2026-11') e NÃO
// restaura a grade de teste (fixture, sem valor histórico).

const GRADE_TAG = 'grade-real-2026-11'

const buildGrid = () => {
  const slots = []
  const today = new Date()
  const day = today.getUTCDay() // 0 dom, 1 seg ... 6 sáb
  const daysUntilMonday = (8 - day) % 7 || 7
  const monday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilMonday),
  )
  for (let d = 0; d < 28; d++) {
    const current = new Date(monday.getTime() + d * 86400000)
    const weekday = current.getUTCDay()
    if (weekday === 0 || weekday === 6) continue // somente dias úteis (seg–sex)
    // faixas de CAPACIDADE por horário de início (minutos do dia):
    //   07:00–10:30 → 1 · 11:00–16:30 → 2 · 17:00–19:30 → 1
    const inicios = []
    for (let m = 7 * 60; m <= 19 * 60 + 30; m += 30) inicios.push(m)
    for (const startMinutes of inicios) {
      const h = Math.floor(startMinutes / 60)
      const m = startMinutes % 60
      const capacity = startMinutes >= 11 * 60 && startMinutes < 17 * 60 ? 2 : 1
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const iso = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')} ${hh}:${mm}:00.000Z`
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
  return slots
}

migrate(
  (app) => {
    const slots = app.findCollectionByNameOrId('agenda_slots')

    // a grade de teste futura (0064) sai do ar — substituída pela grade REAL
    try {
      const antigas = app.findRecordsByFilter(
        'agenda_slots',
        "created_by = 'grade-teste-2026-11'",
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
        "created_by = 'grade-real-2026-11'",
        '-slot_datetime',
        0,
        0,
      )
      records.forEach((record) => app.delete(record))
    } catch (_) {}
  },
)
