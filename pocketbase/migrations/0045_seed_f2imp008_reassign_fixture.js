// F2-IMP-008 — fixture fresca para provar REASSIGN antes de CLOSE.
// A fixture 008 original foi encerrada durante a prova de fechamento; esta é
// isolada para a ordem correta: Supervisora reatribui, depois a Gestão pode
// encerrar/inspecionar sem apagar histórico.

migrate(
  (app) => {
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const events = app.findCollectionByNameOrId('lead_appointment_events')
    try {
      app.findFirstRecordByData('lead_appointments', 'appointment_id', 'appt-reatribuicao-008b')
      return
    } catch (_) {}
    const record = new Record(appointments)
    const data = {
      appointment_id: 'appt-reatribuicao-008b',
      lead_submission_id: 'sub-reatribuicao-008b',
      form_id: 'fellice-captura-01',
      form_version: 'v1.0.0',
      slot_id: '',
      slot_datetime: '2026-09-18 16:05:00.000Z',
      slot_duration_min: 30,
      nome: 'Lead Reatribuição Teste B',
      telefone_ou_canal_de_retorno: '+55 71 90000-0082',
      localidade: 'comercial',
      profissao: 'Engenheira (sintético)',
      email: '',
      status: 'ENCAMINHAMENTO_HUMANO',
      conflict_detected: false,
      handoff_reason: 'falha de sistema (fixture F2-IMP-008B)',
      created_at: '2026-09-18 16:05:00.000Z',
      objetivo: 'Condicionamento físico e resistência',
      proximidade: 'Passo com frequência pela região',
      ocupacao: 'Autônomo/Empresário',
      interesse_em_visita: 'Sim, quero agendar uma visita presencial',
      utm_source: 'fixture',
      utm_medium: 'teste',
      utm_campaign: 'f2-imp-008b',
      attribution_status: 'recebida',
      turno_origem: 'TARDE',
      turno_fim_at: '2026-09-18 19:00:00.000Z',
    }
    for (const [key, value] of Object.entries(data)) record.set(key, value)
    app.save(record)
    const event = new Record(events)
    event.set('event_id', 'evt-appt-reatribuicao-008b')
    event.set('appointment_id', data.appointment_id)
    event.set('lead_submission_id', data.lead_submission_id)
    event.set('event_type', 'APPOINTMENT_HANDOFF')
    event.set('occurred_at', data.created_at)
    event.set('actor_id', 'public')
    event.set('payload', { fixture: 'F2-IMP-008B' })
    app.save(event)
  },
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData(
          'lead_appointment_events',
          'event_id',
          'evt-appt-reatribuicao-008b',
        ),
      )
    } catch (_) {}
    try {
      app.delete(
        app.findFirstRecordByData('lead_appointments', 'appointment_id', 'appt-reatribuicao-008b'),
      )
    } catch (_) {}
  },
)
