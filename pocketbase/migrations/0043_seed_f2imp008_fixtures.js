// F2-IMP-008 — fixtures sintéticas para escalada, reatribuição e encerramento.
// Não cria usuários nem credenciais. As provas usam contas autorizadas existentes;
// se não houver conta gestao/supervisora, a validação humana fica bloqueada sem
// alterar o produto ou registrar senha no repositório.

migrate(
  (app) => {
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const events = app.findCollectionByNameOrId('lead_appointment_events')
    const rows = [
      {
        appointment_id: 'appt-escalada-008',
        lead_submission_id: 'sub-escalada-008',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '2026-09-17 12:05:00.000Z',
        slot_duration_min: 30,
        nome: 'Lead Escalada Teste',
        telefone_ou_canal_de_retorno: '+55 71 90000-0080',
        localidade: 'residencial',
        profissao: 'Analista (sintético)',
        email: '',
        status: 'ENCAMINHAMENTO_HUMANO',
        conflict_detected: false,
        handoff_reason: 'sem horário disponível (fixture F2-IMP-008)',
        created_at: '2026-09-17 12:05:00.000Z',
        objetivo: 'Emagrecimento',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'CLT',
        interesse_em_visita: 'Sim, quero agendar uma aula experimental',
        utm_source: 'fixture',
        utm_medium: 'teste',
        utm_campaign: 'f2-imp-008',
        attribution_status: 'recebida',
        turno_origem: 'MANHA',
        turno_fim_at: '2026-09-17 15:00:00.000Z',
      },
      {
        appointment_id: 'appt-reatribuicao-008',
        lead_submission_id: 'sub-reatribuicao-008',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '2026-09-17 16:05:00.000Z',
        slot_duration_min: 30,
        nome: 'Lead Reatribuição Teste',
        telefone_ou_canal_de_retorno: '+55 71 90000-0081',
        localidade: 'comercial',
        profissao: 'Professor (sintético)',
        email: '',
        status: 'ENCAMINHAMENTO_HUMANO',
        conflict_detected: false,
        handoff_reason: 'dúvida antes de agendar (fixture F2-IMP-008)',
        created_at: '2026-09-17 16:05:00.000Z',
        objetivo: 'Ganho de massa muscular',
        proximidade: 'Moro no Itaigara ou bairros vizinhos',
        ocupacao: 'Estudante',
        interesse_em_visita: 'Sim, quero agendar uma visita presencial',
        utm_source: 'fixture',
        utm_medium: 'teste',
        utm_campaign: 'f2-imp-008',
        attribution_status: 'recebida',
        dono: 'consultor-fixture-008',
        assumed_at: '2026-09-17 16:10:00.000Z',
        turno_origem: 'TARDE',
        turno_fim_at: '2026-09-17 19:00:00.000Z',
      },
    ]

    for (const data of rows) {
      try {
        app.findFirstRecordByData('lead_appointments', 'appointment_id', data.appointment_id)
      } catch (_) {
        const record = new Record(appointments)
        for (const [key, value] of Object.entries(data)) record.set(key, value)
        app.save(record)
      }
      const eventId = `evt-${data.appointment_id}`
      try {
        app.findFirstRecordByData('lead_appointment_events', 'event_id', eventId)
      } catch (_) {
        const event = new Record(events)
        event.set('event_id', eventId)
        event.set('appointment_id', data.appointment_id)
        event.set('lead_submission_id', data.lead_submission_id)
        event.set('event_type', 'APPOINTMENT_HANDOFF')
        event.set('occurred_at', data.created_at)
        event.set('actor_id', 'public')
        event.set('payload', { fixture: 'F2-IMP-008', handoff_reason: data.handoff_reason })
        app.save(event)
      }
    }
  },
  (app) => {
    const ids = ['appt-escalada-008', 'appt-reatribuicao-008']
    for (const id of ids) {
      try {
        app.delete(app.findFirstRecordByData('lead_appointment_events', 'appointment_id', id))
      } catch (_) {}
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', id))
      } catch (_) {}
    }
  },
)
