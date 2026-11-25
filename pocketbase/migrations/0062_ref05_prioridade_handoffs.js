// REF-05 debug r2 — a migração 0060 adicionou os campos de prioridade em
// lead_submissions e lead_appointments, mas NÃO em lead_handoffs — a coleção
// que a Fila (/fila) lê. A gravação de prioridade_* no handoff era ignorada
// pelo PocketBase (campo inexistente). Esta migração completa o conjunto.
// Histórico anterior não é recalculado (regra 5 da SPEC): handoffs antigos
// permanecem sem nota e exibem "Sem pontuação".

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('lead_handoffs')
    const addField = (name, type, extra) => {
      let exists = false
      const all = col.fields.getAll ? col.fields.getAll() : []
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
        col.fields.add(new Field(def))
      }
    }
    addField('prioridade_nota', 'number', { min: 0, max: 10, onlyInt: true })
    addField('prioridade_faixa', 'select', {
      maxSelect: 1,
      values: ['alta', 'media', 'baixa', 'sem_pontuacao'],
    })
    addField('prioridade_matriz', 'text', { max: 20 })
    addField('prioridade_motivo', 'text', { max: 200 })
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('lead_handoffs')
    const names = ['prioridade_nota', 'prioridade_faixa', 'prioridade_matriz', 'prioridade_motivo']
    const all = col.fields.getAll ? col.fields.getAll() : []
    for (const f of all) {
      if (names.indexOf(f.name) >= 0) {
        col.fields.remove(f)
      }
    }
    app.save(col)
  },
)
