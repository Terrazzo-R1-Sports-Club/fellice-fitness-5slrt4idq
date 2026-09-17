// F2-IMP-002 / SPEC-2-001 — grade de disponibilidade sintética em ambiente de teste.
// Materializa a decisão F2-T001: slot 30 min; capacidade 1; exceção de capacidade 2 para
// blocos que COMEÇAM entre 11:30 e 16:30 EXATOS (interpretado pelo consultor em 2026-09-17 —
// o último bloco da janela é 16:30–17:00). A regra não distingue dia da semana, então
// também se aplica aos blocos de sábado dentro da janela [VALIDAR NA CALL DE SETUP].
//
// Grade: 14 dias a partir da próxima segunda-feira. Seg–sex 08:00–19:30; sáb 09:00–13:30.
// Sem domingo. Status ABERTO. created_by = 'grade-teste' (âncora do rollback cirúrgico).
//
// Idempotente: não duplica slot_id existente. Remove os 3 slots de fixture da F2-IMP-001
// (substituídos pela grade real de teste); as TENTATIVAS de teste não são tocadas.
// Down: remove apenas os slots criados aqui (created_by='grade-teste').

const GRADE_TAG = 'grade-teste'

const buildGrid = () => {
  const slots = []
  const today = new Date()
  const day = today.getUTCDay() // 0 dom, 1 seg ... 6 sáb
  const daysUntilMonday = (8 - day) % 7 || 7
  const monday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilMonday),
  )
  for (let d = 0; d < 14; d++) {
    const current = new Date(monday.getTime() + d * 86400000)
    const weekday = current.getUTCDay()
    if (weekday === 0) continue // domingo sem grade
    const startHour = weekday === 6 ? 9 : 8
    const endHour = weekday === 6 ? 13 : 19
    const endMinute = weekday === 6 ? 30 : 30
    for (let h = startHour; h <= endHour; h++) {
      for (const m of [0, 30]) {
        if (h === startHour && m < 0) continue
        if (h === endHour && m > endMinute - 30) continue // último bloco termina :30
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

    // remove fixtures antigas da F2-IMP-001 (substituídas pela grade de teste)
    const oldFixtures = [
      'slot-teste-cap1-0830',
      'slot-teste-cap2-1200',
      'slot-teste-bloqueado-1700',
    ]
    oldFixtures.forEach((id) => {
      try {
        app.delete(app.findFirstRecordByData('agenda_slots', 'slot_id', id))
      } catch (_) {}
    })

    const grid = buildGrid()
    grid.forEach((data) => {
      try {
        app.findFirstRecordByData('agenda_slots', 'slot_id', data.slot_id)
      } catch (_) {
        const record = new Record(slots)
        // JSVM: set exige (chave, valor) — aprendizado AP-2026-09-17-1527
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
        "created_by = 'grade-teste'",
        '-slot_datetime',
        0,
        0,
      )
      records.forEach((record) => app.delete(record))
    } catch (_) {}
  },
)
