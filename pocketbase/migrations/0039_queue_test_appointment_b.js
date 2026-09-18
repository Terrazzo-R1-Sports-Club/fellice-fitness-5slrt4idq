// F2-IMP-007 — DEBUG r1: nova tentativa SEM dono para o reteste humano.
// A fixture appt-teste-fila-007 foi assumida na prova via API e o hook (corretamente)
// não permite desfazer sem reatribuição formal (F2-IMP-008) — o reteste do consultor
// usa esta nova tentativa. Removida no fechamento (após aceite), junto da 0037.

migrate(
  (app) => {
    // idempotente: se a fixture já existe, nada a fazer
    try {
      app.findFirstRecordByData('lead_appointments', 'appointment_id', 'appt-teste-fila-007b')
      return
    } catch (_) {
      // não existe — prosseguir com a criação
    }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z'
    const appts = app.findCollectionByNameOrId('lead_appointments')
    const appt = new Record(appts)
    appt.set('appointment_id', 'appt-teste-fila-007b')
    appt.set('lead_submission_id', 'sub-teste-0002b')
    appt.set('form_id', 'fellice-captura-01')
    appt.set('form_version', 'v1.0.0')
    appt.set('slot_id', '')
    appt.set('slot_datetime', now)
    appt.set('slot_duration_min', 30)
    appt.set('nome', 'Lead Fila Teste B')
    appt.set('telefone_ou_canal_de_retorno', '+55 71 90000-0003')
    appt.set('status', 'ENCAMINHAMENTO_HUMANO')
    appt.set('conflict_detected', false)
    appt.set('handoff_reason', 'lead solicitou atendimento humano na tela de agendamento')
    appt.set('created_at', now)
    appt.set('objetivo', 'Ganho de massa muscular')
    appt.set('proximidade', 'Moro no Itaigara ou em bairros vizinhos')
    appt.set('ocupacao', 'Estudante')
    appt.set('interesse_em_visita', 'Sim, quero agendar uma visita presencial')
    appt.set('utm_source', 'instagram')
    appt.set('utm_medium', 'cpc')
    appt.set('utm_campaign', 'inverno-2026')
    appt.set('attribution_status', 'recebida')
    app.save(appt)
  },
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('lead_appointments', 'appointment_id', 'appt-teste-fila-007b'),
      )
    } catch (_) {}
  },
)
