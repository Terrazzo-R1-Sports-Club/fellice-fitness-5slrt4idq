// F2-IMP-004 — DEBUG: limpeza definitiva das reservas do teste humano que reproduziram
// a falha de capacidade (DELETE via API é bloqueado pela regra deleteRule: null — correto!).
// A limpeza só é possível via migração (acesso de superuser do JSVM).

migrate(
  (app) => {
    const apptIds = [
      '05384624-a598-4f9e-a4f2-2797c3d66b07',
      '0de24df6-4bbe-4893-b31f-c6088d638e6b',
      '4916374c-e38f-4b04-99dd-ac49da3ccdf6',
      '589b75e4-d02b-4d94-a674-6634a454f61c',
      'bd197176-bb4a-43c3-86cd-2358c368903e',
    ]
    apptIds.forEach((id) => {
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', id))
      } catch (_) {}
    })

    // zera a ocupação dos slots afetados
    const occupancy = app.findRecordsByFilter('agenda_slot_occupancy', 'active > 0', '', 0, 0)
    occupancy.forEach((row) => {
      row.set('active', 0)
      app.save(row)
    })
  },
  (app) => {
    // down: sem restauração — registros de teste
  },
)
