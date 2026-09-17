// F2-IMP-004 — Fechamento: limpeza das reservas do teste humano (aprovado em 2026-09-17
// pelo consultor) que reproduziram a falha de capacidade. deleteRule null impede via API;
// limpeza só via migração. Ocupação ressincronizada pelo próprio hook ao apagar.

migrate(
  (app) => {
    const ids = [
      'cc92b73a-4a21-4b34-8618-9af85912ea89',
      '84ea8241-56ba-4845-8205-81bb2aaf9b31',
      '9aaa8e9c-9021-483e-8960-ad21bad4eb04',
    ]
    ids.forEach((id) => {
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', id))
      } catch (_) {}
    })
  },
  (app) => {
    // down: sem restauração — dados de teste
  },
)
