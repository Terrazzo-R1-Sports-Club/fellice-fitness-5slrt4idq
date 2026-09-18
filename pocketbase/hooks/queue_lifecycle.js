// F2-IMP-008 — calcula o turno de origem e o fim do turno no servidor.
// Salvador/UTC-3: MANHA 08:00–12:00, TARDE 12:00–16:00, NOITE 16:00–20:00.
// Não altera status automaticamente; somente preenche contexto temporal.

onRecordCreate((e) => {
  const rec = e.record
  if (!rec.getString('turno_origem', '')) {
    const raw = rec.getString('created_at', '') || new Date().toISOString()
    const parsed = new Date(raw.replace(' ', 'T'))
    if (Number.isNaN(parsed.getTime())) {
      rec.set('turno_origem', 'FORA_TURNO')
    } else {
      const local = new Date(parsed.getTime() - 3 * 60 * 60 * 1000)
      const hour = local.getUTCHours()
      let shift = 'FORA_TURNO'
      let endHour = 0
      if (hour >= 8 && hour < 12) {
        shift = 'MANHA'
        endHour = 12
      } else if (hour >= 12 && hour < 16) {
        shift = 'TARDE'
        endHour = 16
      } else if (hour >= 16 && hour < 20) {
        shift = 'NOITE'
        endHour = 20
      }
      rec.set('turno_origem', shift)
      if (shift !== 'FORA_TURNO' && !rec.getString('turno_fim_at', '')) {
        rec.set(
          'turno_fim_at',
          new Date(
            Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), endHour + 3),
          ).toISOString(),
        )
      }
    }
  }
  e.next()
}, 'lead_appointments')
