// F2-IMP-006 — Campos de contexto da triagem em lead_appointments.
// A visão operacional (SPEC-2-002) precisa mostrar o contexto da triagem (objetivo,
// proximidade, ocupação, interesse, UTMs) junto da tentativa. lead_submissions é 403
// para consultor (só superuser), então o contexto é COPIADO para o appointment no
// momento da criação (hook enforce_slot_capacity.js — mesma coleção) — padrão da fila F1.
// Migração adiciona os campos; hook preenche nos novos registros; 0028 semeia fixtures.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('lead_appointments')
    const fields = [
      { name: 'objetivo', type: 'text', max: 200 },
      { name: 'proximidade', type: 'text', max: 200 },
      { name: 'ocupacao', type: 'text', max: 200 },
      { name: 'interesse_em_visita', type: 'text', max: 200 },
      { name: 'utm_source', type: 'text', max: 200 },
      { name: 'utm_medium', type: 'text', max: 200 },
      { name: 'utm_campaign', type: 'text', max: 200 },
      { name: 'attribution_status', type: 'text', max: 20 },
    ]
    for (const f of fields) {
      // upsert de campo: ignora se já existir
      let exists = false
      try {
        collection.fields.getByName(f.name)
        exists = true
      } catch (_) {
        exists = false
      }
      if (!exists) {
        collection.fields.add(new Field({ name: f.name, type: f.type, max: f.max }))
      }
    }
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
    for (const name of names) {
      try {
        collection.fields.removeByName(name)
      } catch (_) {}
    }
    app.save(collection)
  },
)
