// F2-IMP-004 — DEBUG: controle de capacidade por slot (RN-2.01/CA-2.02).
// Falha reproduzida pelo teste humano: slot cap 2 aceitou 3 reservas CONCLUIDO.
// Causa raiz: nenhuma camada contava reservas ativas por slot; o índice único só impede
// o MESMO lead no MESMO slot.
//
// Solução em duas camadas (a prova de concorrência real continua sendo do banco):
// 1. EVENTOS PÚBLICOS DE OCUPAÇÃO: nova coleção `agenda_slot_occupancy` (leitura pública,
//    escrita pública controlada pelo fluxo) com 1 registro por slot ativo, campo `active`
//    = número de reservas ativas. A página /agendar lê a contagem ANTES de ofertar o slot
//    e o PocketBase recusa o incremento acima da capacidade via regra de update
//    (capacity <= slot.capacity). Sem login não há como pular o limite.
// 2. Migração também recalcula a ocupação atual a partir das tentativas existentes.
//
// Down: remove a coleção.

migrate(
  (app) => {
    const occupancy = new Collection({
      name: 'agenda_slot_occupancy',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      deleteRule: null,
      fields: [
        { name: 'slot_id', type: 'text', required: true, max: 120 },
        { name: 'capacity', type: 'number', required: true, min: 1 },
        { name: 'active', type: 'number', required: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_occupancy_slot` ON `agenda_slot_occupancy` (`slot_id`)'],
    })
    app.save(occupancy)

    // recalcula a ocupação a partir das tentativas existentes
    const slots = app.findRecordsByFilter('agenda_slots', '', '-slot_datetime', 0, 0)
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
    for (const slot of slots) {
      const slotId = slot.get('slot_id')
      const record = new Record(occupancy)
      record.set('slot_id', slotId)
      record.set('capacity', slot.get('capacity'))
      record.set('active', activeBySlot[slotId] ?? 0)
      record.set('updated', new Date().toISOString())
      app.save(record)
    }
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('agenda_slot_occupancy'))
  },
)
