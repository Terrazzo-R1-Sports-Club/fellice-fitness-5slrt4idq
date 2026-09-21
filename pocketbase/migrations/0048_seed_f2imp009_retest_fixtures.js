// F2-IMP-009 r1 — fixtures de reteste do cenário 2 (exibição do dono após troca
// de usuário) e do cenário 5 (assunção durante rollback). Reutiliza os usuários
// sintéticos da 0047 (removidos só na limpeza pós-aceite). Nada de schema.

migrate(
  (app) => {
    const consultorAId = app.findFirstRecordByData(
      'users',
      'email',
      'consultor.a.f2imp009@fellice-fitness.local',
    ).id

    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const rows = [
      {
        appointment_id: 'appt-reteste-009-fila',
        lead_submission_id: 'sub-reteste-009-fila',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '',
        slot_duration_min: 30,
        nome: 'Lead Reteste Fila r1',
        telefone_ou_canal_de_retorno: '+55 71 90000-0911',
        localidade: 'residencial',
        profissao: 'Analista (sintético)',
        email: '',
        status: 'ENCAMINHAMENTO_HUMANO',
        conflict_detected: false,
        handoff_reason: 'fixture de reteste do cenário 2 (F2-IMP-009 r1)',
        created_at: '2026-09-21 14:30:00.000Z',
        objetivo: 'Emagrecimento',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'CLT',
        interesse_em_visita: 'Sim, quero agendar uma aula experimental',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'reteste-f2-009',
        attribution_status: 'recebida',
        turno_origem: 'TARDE',
        turno_fim_at: '2026-09-21 19:00:00.000Z',
      },
      {
        appointment_id: 'appt-reteste-009-rollback',
        lead_submission_id: 'sub-reteste-009-rollback',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '',
        slot_duration_min: 30,
        nome: 'Lead Reteste Rollback r1',
        telefone_ou_canal_de_retorno: '+55 71 90000-0912',
        localidade: 'comercial',
        profissao: 'Professor (sintético)',
        email: '',
        status: 'ENCAMINHAMENTO_HUMANO',
        conflict_detected: false,
        handoff_reason: 'fixture de reteste do cenário 5 (F2-IMP-009 r1)',
        created_at: '2026-09-21 14:35:00.000Z',
        objetivo: 'Ganho de massa muscular',
        proximidade: 'Moro no Itaigara ou bairros vizinhos',
        ocupacao: 'Autônomo/Empresário',
        interesse_em_visita: 'Sim, quero agendar uma visita presencial',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'reteste-f2-009',
        attribution_status: 'recebida',
        turno_origem: 'TARDE',
        turno_fim_at: '2026-09-21 19:00:00.000Z',
      },
      {
        appointment_id: 'appt-reteste-009-assumido',
        lead_submission_id: 'sub-reteste-009-assumido',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '',
        slot_duration_min: 30,
        nome: 'Lead Reteste Assumido r1',
        telefone_ou_canal_de_retorno: '+55 71 90000-0913',
        localidade: 'residencial',
        profissao: 'Enfermeiro (sintético)',
        email: '',
        status: 'ENCAMINHAMENTO_HUMANO',
        conflict_detected: false,
        handoff_reason: 'fixture de reteste da exibição do dono (F2-IMP-009 r1)',
        created_at: '2026-09-21 14:40:00.000Z',
        objetivo: 'Saúde, mobilidade e qualidade de vida',
        proximidade: 'Passo com frequência pela região',
        ocupacao: 'Profissional da saúde, educação ou outra área com horário irregular',
        interesse_em_visita: 'Quero receber mais informações antes de decidir',
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: '',
        attribution_status: 'incompleta',
        dono: consultorAId,
        assumed_at: '2026-09-21 14:45:00.000Z',
        turno_origem: 'MANHA',
        turno_fim_at: '2026-09-21 15:00:00.000Z',
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
    }

    const events = app.findCollectionByNameOrId('lead_appointment_events')
    const eventRows = [
      [
        'evt-reteste-009-fila',
        'appt-reteste-009-fila',
        'sub-reteste-009-fila',
        'APPOINTMENT_CREATED',
        '2026-09-21 14:30:00.000Z',
      ],
      [
        'evt-reteste-009-fila2',
        'appt-reteste-009-fila',
        'sub-reteste-009-fila',
        'APPOINTMENT_HANDOFF',
        '2026-09-21 14:31:00.000Z',
      ],
      [
        'evt-reteste-009-rb',
        'appt-reteste-009-rollback',
        'sub-reteste-009-rollback',
        'APPOINTMENT_CREATED',
        '2026-09-21 14:35:00.000Z',
      ],
      [
        'evt-reteste-009-rb2',
        'appt-reteste-009-rollback',
        'sub-reteste-009-rollback',
        'APPOINTMENT_HANDOFF',
        '2026-09-21 14:36:00.000Z',
      ],
      [
        'evt-reteste-009-assm',
        'appt-reteste-009-assumido',
        'sub-reteste-009-assumido',
        'APPOINTMENT_CREATED',
        '2026-09-21 14:40:00.000Z',
      ],
      [
        'evt-reteste-009-assm2',
        'appt-reteste-009-assumido',
        'sub-reteste-009-assumido',
        'APPOINTMENT_HANDOFF',
        '2026-09-21 14:41:00.000Z',
      ],
      [
        'evt-reteste-009-assm3',
        'appt-reteste-009-assumido',
        'sub-reteste-009-assumido',
        'APPOINTMENT_ASSUMED',
        '2026-09-21 14:45:00.000Z',
      ],
    ]
    for (const [eventId, apptId, subId, type, occurredAt] of eventRows) {
      try {
        app.findFirstRecordByData('lead_appointment_events', 'event_id', eventId)
      } catch (_) {
        const event = new Record(events)
        event.set('event_id', eventId)
        event.set('appointment_id', apptId)
        event.set('lead_submission_id', subId)
        event.set('event_type', type)
        event.set('occurred_at', occurredAt)
        event.set('actor_id', 'public')
        event.set('payload', { fixture: 'F2-IMP-009-r1' })
        app.save(event)
      }
    }
  },
  (app) => {
    const appointmentIds = [
      'appt-reteste-009-fila',
      'appt-reteste-009-rollback',
      'appt-reteste-009-assumido',
    ]
    for (const appointmentId of appointmentIds) {
      let rows = []
      try {
        rows = app.findRecordsByFilter(
          'lead_appointment_events',
          'appointment_id = {:id}',
          '',
          0,
          0,
          { id: appointmentId },
        )
      } catch (_) {}
      for (const row of rows) {
        try {
          app.delete(row)
        } catch (_) {}
      }
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', appointmentId))
      } catch (_) {}
    }
  },
)
