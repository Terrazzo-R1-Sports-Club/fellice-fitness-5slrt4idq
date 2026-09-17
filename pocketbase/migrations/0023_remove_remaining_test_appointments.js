// F2-IMP-004 — Fechamento (complemento): remove as 2 reservas do 2º teste humano
// ("testte" slot 0900 e "tste" slot 1300, criadas às 19:49 durante o teste aprovado)
// e a reserva da prova rápida pós-limpeza. O hook ressincroniza a ocupação ao apagar.

migrate(
  (app) => {
    const ids = [
      '4bde5012-692d-420d-8926-695c1477d4da',
      'e74cb790-d08d-4940-9b8f-146cf445d405',
      'appt-pos-limpeza',
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
