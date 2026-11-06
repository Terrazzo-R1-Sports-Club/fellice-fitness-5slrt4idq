// REF-05 / SPEC-4-004 — pontuação de ocupação para priorizar o atendimento.
// Campos de prioridade calculada na conclusão da triagem (matriz v1, aprovada
// pela cliente em 06/11/2026): nota (0–10), faixa (alta/media/baixa/sem_pontuacao),
// versão da matriz e motivo (a resposta que gerou a nota). Campos idênticos em
// lead_appointments para a Visão exibir a prioridade do agendamento. Histórico
// anterior não é recalculado (regra 5 da SPEC); registros antigos ficam sem nota.
// Padrão JSVM do projeto (0029/0035): fields.getAll + new Field({name, type, ...}).

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

    const submissions = app.findCollectionByNameOrId('lead_submissions')
    addField(submissions, 'prioridade_nota', 'number', { min: 0, max: 10, onlyInt: true })
    addField(submissions, 'prioridade_faixa', 'select', {
      maxSelect: 1,
      values: ['alta', 'media', 'baixa', 'sem_pontuacao'],
    })
    addField(submissions, 'prioridade_matriz', 'text', { max: 20 })
    addField(submissions, 'prioridade_motivo', 'text', { max: 200 })
    app.save(submissions)

    const appointments = app.findCollectionByNameOrId('lead_appointments')
    addField(appointments, 'prioridade_nota', 'number', { min: 0, max: 10, onlyInt: true })
    addField(appointments, 'prioridade_faixa', 'select', {
      maxSelect: 1,
      values: ['alta', 'media', 'baixa', 'sem_pontuacao'],
    })
    addField(appointments, 'prioridade_matriz', 'text', { max: 20 })
    addField(appointments, 'prioridade_motivo', 'text', { max: 200 })
    app.save(appointments)
  },
  (app) => {
    const names = ['prioridade_nota', 'prioridade_faixa', 'prioridade_matriz', 'prioridade_motivo']
    for (const colName of ['lead_submissions', 'lead_appointments']) {
      const col = app.findCollectionByNameOrId(colName)
      const all = col.fields.getAll ? col.fields.getAll() : []
      for (const f of all) {
        if (names.indexOf(f.name) >= 0) {
          col.fields.remove(f)
        }
      }
      app.save(col)
    }
  },
)
