// F2-IMP-006 — DEBUG: adiciona os campos de contexto da triagem em lead_appointments.
// A 0027 original aplicou "ok" mas os campos não apareceram (new Field() provavelmente
// não registrados no JSVM). Esta migração usa a notação de definição de coleção que
// funcionou na 0007: redefinir via fields.add com Field nomeado por índice.
// Estratégia alternativa robusta: criar uma coleção temporária com os campos desejados
// não é necessário — usar collection.fields.add(new Field(...)) com objeto literal
// completo, como a documentação do PocketBase v0.36 JSVM indica.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('lead_appointments')

    const addField = (name, type, max) => {
      // verifica existência via loop (getByName pode não existir no JSVM)
      let exists = false
      const all = collection.fields.getAll ? collection.fields.getAll() : []
      for (const f of all) {
        if (f.name === name) {
          exists = true
          break
        }
      }
      if (!exists) {
        const field = new Field({ name: name, type: type, max: max })
        collection.fields.add(field)
      }
    }

    addField('objetivo', 'text', 200)
    addField('proximidade', 'text', 200)
    addField('ocupacao', 'text', 200)
    addField('interesse_em_visita', 'text', 200)
    addField('utm_source', 'text', 200)
    addField('utm_medium', 'text', 200)
    addField('utm_campaign', 'text', 200)
    addField('attribution_status', 'text', 20)

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('lead_appointments')
    const names = [
      'objetivo',
      'proximidade',
      'ocupacao',
      'interesse_em_visita',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'attribution_status',
    ]
    const all = collection.fields.getAll ? collection.fields.getAll() : []
    for (const f of all) {
      if (names.indexOf(f.name) >= 0) {
        collection.fields.remove(f)
      }
    }
    app.save(collection)
  },
)
