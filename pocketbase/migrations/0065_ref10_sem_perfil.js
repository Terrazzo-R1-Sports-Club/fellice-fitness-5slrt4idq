// REF-10 / SPEC-4-004 — classificação "Sem perfil" (manual, pelo operador).
// Campos em lead_appointments: sem_perfil_at (data/hora da classificação; vazio =
// não classificado), sem_perfil_motivo (texto, motivo obrigatório — insumo 2) e
// sem_perfil_por (ID do operador que classificou — insumo 1: mesmo acesso da Visão).
// A reversão (insumo 4) limpa os três campos; o histórico fica no evento
// APPOINTMENT_SEM_PERFIL (payload {motivo, reversao}). Nenhum status existente
// muda (rótulo ≠ estado); a reserva não é alterada (insumo 5). Histórico anterior
// não é recalculado (regra 5 da SPEC): registros antigos ficam sem classificação.
migrate(
  (app) => {
    const addField = (collection, name, type, extra) => {
      let exists = false
      const all = collection.fields.getAll ? collection.fields.getAll() : []
      for (const f of all) {
        if (f.name === name) {
          exists = true
          break
        }
      }
      if (!exists) {
        const def = { name: name, type: type }
        if (extra) {
          for (const k in extra) {
            def[k] = extra[k]
          }
        }
        collection.fields.add(new Field(def))
      }
    }

    const col = app.findCollectionByNameOrId('lead_appointments')
    addField(col, 'sem_perfil_at', 'text', { max: 40 })
    addField(col, 'sem_perfil_motivo', 'text', { max: 200 })
    addField(col, 'sem_perfil_por', 'text', { max: 40 })
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('lead_appointments')
    const names = ['sem_perfil_at', 'sem_perfil_motivo', 'sem_perfil_por']
    const all = col.fields.getAll ? col.fields.getAll() : []
    for (const f of all) {
      if (names.indexOf(f.name) >= 0) {
        col.fields.remove(f)
      }
    }
    app.save(col)
  },
)
