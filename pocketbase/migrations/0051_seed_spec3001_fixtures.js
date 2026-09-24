// Fase 3 / SPEC-3-001 — fixtures sintéticas temporárias.
// Cobrem atribuição completa/parcial/ausente, etapas do funil, handoff por duas fontes,
// agendamento concluído sem vínculo e reprocessamento sem dupla contagem.
// Os registros usam apenas dados sintéticos e devem ser removidos após o aceite humano.

migrate(
  (app) => {
    const submissions = app.findCollectionByNameOrId('lead_submissions')
    const submissionRows = [
      {
        lead_submission_id: 'spec3001-sub-complete',
        started_at: '2026-09-23T09:00:00.000Z',
        submitted_at: '2026-09-23T09:04:00.000Z',
        nome: 'Lead Sintético Completo',
        canal_de_retorno: 'canal-sintetico-01',
        objetivo: 'Emagrecimento',
        proximidade: 'Moro no Itaigara ou em bairros vizinhos',
        ocupacao: 'CLT',
        interesse_em_visita: 'Sim, quero agendar uma visita presencial',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'spec3001-completa',
        attribution_status: 'recebida',
        triagem_status: 'TRIAGEM_CONCLUIDA',
      },
      {
        lead_submission_id: 'spec3001-sub-partial',
        started_at: '2026-09-23T10:00:00.000Z',
        submitted_at: '2026-09-23T10:04:00.000Z',
        nome: 'Lead Sintético Parcial',
        canal_de_retorno: 'canal-sintetico-02',
        objetivo: 'Ganho de massa muscular',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'Autônomo/Empresário',
        interesse_em_visita: 'Sim, quero agendar uma aula experimental',
        utm_source: 'facebook',
        utm_medium: '',
        utm_campaign: '',
        attribution_status: 'incompleta',
        triagem_status: 'TRIAGEM_CONCLUIDA',
      },
      {
        lead_submission_id: 'spec3001-sub-absent',
        started_at: '2026-09-23T11:00:00.000Z',
        submitted_at: '',
        nome: 'Lead Sintético Sem Atribuição',
        canal_de_retorno: 'canal-sintetico-03',
        objetivo: 'Condicionamento físico e resistência',
        proximidade: 'Passo com frequência pela região',
        ocupacao: 'Estudante',
        interesse_em_visita: 'Quero receber mais informações antes de decidir',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        attribution_status: 'ausente',
        triagem_status: 'EM_ANDAMENTO',
      },
      {
        lead_submission_id: 'spec3001-sub-handoff',
        started_at: '2026-09-23T12:00:00.000Z',
        submitted_at: '2026-09-23T12:04:00.000Z',
        nome: 'Lead Sintético Handoff',
        canal_de_retorno: 'canal-sintetico-04',
        objetivo: 'Saúde, mobilidade e qualidade de vida',
        proximidade: 'Moro/trabalho em outra região, mas me desloco para treinar',
        ocupacao: 'Profissional da saúde, educação ou outra área com horário irregular',
        interesse_em_visita: 'Sim, quero agendar uma aula experimental',
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: '',
        attribution_status: 'incompleta',
        triagem_status: 'TRIAGEM_CONCLUIDA',
      },
      {
        lead_submission_id: 'spec3001-sub-reschedule',
        started_at: '2026-09-23T13:00:00.000Z',
        submitted_at: '2026-09-23T13:04:00.000Z',
        nome: 'Lead Sintético Reprocessamento',
        canal_de_retorno: 'canal-sintetico-05',
        objetivo: 'Melhorar a performance esportiva',
        proximidade: 'Moro no Itaigara ou em bairros vizinhos',
        ocupacao: 'Executivo/Gestor',
        interesse_em_visita: 'Sim, quero agendar uma visita presencial',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'spec3001-reprocessamento',
        attribution_status: 'recebida',
        triagem_status: 'TRIAGEM_CONCLUIDA',
      },
      {
        lead_submission_id: 'spec3001-sub-appt-handoff',
        started_at: '2026-09-23T14:00:00.000Z',
        submitted_at: '2026-09-23T14:04:00.000Z',
        nome: 'Lead Sintético Handoff Agenda',
        canal_de_retorno: 'canal-sintetico-06',
        objetivo: 'Recuperação de lesões',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'Autônomo/Empresário',
        interesse_em_visita: 'Sim, quero agendar uma aula experimental',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'spec3001-handoff-agenda',
        attribution_status: 'recebida',
        triagem_status: 'TRIAGEM_CONCLUIDA',
      },
    ]

    for (const data of submissionRows) {
      try {
        app.findFirstRecordByData('lead_submissions', 'lead_submission_id', data.lead_submission_id)
      } catch (_) {
        const record = new Record(submissions)
        record.set('lead_submission_id', data.lead_submission_id)
        record.set('form_id', 'fellice-captura-01')
        record.set('form_version', 'v1.0.0')
        record.set('started_at', data.started_at)
        record.set('submitted_at', data.submitted_at)
        record.set('nome', data.nome)
        record.set('canal_de_retorno', data.canal_de_retorno)
        record.set('objetivo', data.objetivo)
        record.set('proximidade', data.proximidade)
        record.set('ocupacao', data.ocupacao)
        record.set('interesse_em_visita', data.interesse_em_visita)
        record.set('precisa_de_ajuda_humana', false)
        record.set('utm_source', data.utm_source)
        record.set('utm_medium', data.utm_medium)
        record.set('utm_campaign', data.utm_campaign)
        record.set('attribution_status', data.attribution_status)
        record.set('triagem_status', data.triagem_status)
        record.set('consentimento', true)
        record.set('consentimento_at', data.started_at)
        app.save(record)
      }
    }

    const submissionEvents = app.findCollectionByNameOrId('lead_submission_events')
    const submissionEventRows = [
      [
        'spec3001-evt-start-complete',
        'spec3001-sub-complete',
        'FORM_STARTED',
        '2026-09-23T09:00:00.000Z',
      ],
      [
        'spec3001-evt-triage-complete',
        'spec3001-sub-complete',
        'TRIAGEM_CONCLUIDA',
        '2026-09-23T09:04:00.000Z',
      ],
      [
        'spec3001-evt-start-partial',
        'spec3001-sub-partial',
        'FORM_STARTED',
        '2026-09-23T10:00:00.000Z',
      ],
      [
        'spec3001-evt-triage-partial',
        'spec3001-sub-partial',
        'TRIAGEM_CONCLUIDA',
        '2026-09-23T10:04:00.000Z',
      ],
      [
        'spec3001-evt-start-absent',
        'spec3001-sub-absent',
        'FORM_STARTED',
        '2026-09-23T11:00:00.000Z',
      ],
      [
        'spec3001-evt-start-handoff',
        'spec3001-sub-handoff',
        'FORM_STARTED',
        '2026-09-23T12:00:00.000Z',
      ],
      [
        'spec3001-evt-triage-handoff',
        'spec3001-sub-handoff',
        'TRIAGEM_CONCLUIDA',
        '2026-09-23T12:04:00.000Z',
      ],
      [
        'spec3001-evt-start-reschedule',
        'spec3001-sub-reschedule',
        'FORM_STARTED',
        '2026-09-23T13:00:00.000Z',
      ],
      [
        'spec3001-evt-triage-reschedule',
        'spec3001-sub-reschedule',
        'TRIAGEM_CONCLUIDA',
        '2026-09-23T13:04:00.000Z',
      ],
      [
        'spec3001-evt-start-appt-handoff',
        'spec3001-sub-appt-handoff',
        'FORM_STARTED',
        '2026-09-23T14:00:00.000Z',
      ],
      [
        'spec3001-evt-triage-appt-handoff',
        'spec3001-sub-appt-handoff',
        'TRIAGEM_CONCLUIDA',
        '2026-09-23T14:04:00.000Z',
      ],
    ]
    for (const [eventId, submissionId, eventType, occurredAt] of submissionEventRows) {
      try {
        app.findFirstRecordByData('lead_submission_events', 'event_id', eventId)
      } catch (_) {
        const event = new Record(submissionEvents)
        event.set('event_id', eventId)
        event.set('lead_submission_id', submissionId)
        event.set('event_type', eventType)
        event.set('occurred_at', occurredAt)
        event.set('payload', { fixture: 'SPEC-3-001' })
        app.save(event)
      }
    }

    const handoffs = app.findCollectionByNameOrId('lead_handoffs')
    try {
      app.findFirstRecordByData('lead_handoffs', 'handoff_id', 'spec3001-handoff-01')
    } catch (_) {
      const handoff = new Record(handoffs)
      handoff.set('handoff_id', 'spec3001-handoff-01')
      handoff.set('lead_submission_id', 'spec3001-sub-handoff')
      handoff.set('form_id', 'fellice-captura-01')
      handoff.set('form_version', 'v1.0.0')
      handoff.set('created_at', '2026-09-23T12:05:00.000Z')
      handoff.set('motivo', 'fixture sintética de atendimento humano')
      handoff.set('nome', 'Lead Sintético Handoff')
      handoff.set('canal_de_retorno', 'canal-sintetico-04')
      handoff.set('objetivo', 'Saúde, mobilidade e qualidade de vida')
      handoff.set('proximidade', 'Moro/trabalho em outra região, mas me desloco para treinar')
      handoff.set('ocupacao', 'Profissional da saúde, educação ou outra área com horário irregular')
      handoff.set('interesse_em_visita', 'Sim, quero agendar uma aula experimental')
      handoff.set('utm_source', 'google')
      handoff.set('utm_medium', 'organic')
      handoff.set('utm_campaign', '')
      handoff.set('attribution_status', 'incompleta')
      handoff.set('status', 'PENDENTE')
      app.save(handoff)
    }

    const handoffEvents = app.findCollectionByNameOrId('lead_handoff_events')
    try {
      app.findFirstRecordByData('lead_handoff_events', 'event_id', 'spec3001-handoff-event-01')
    } catch (_) {
      const event = new Record(handoffEvents)
      event.set('event_id', 'spec3001-handoff-event-01')
      event.set('handoff_id', 'spec3001-handoff-01')
      event.set('lead_submission_id', 'spec3001-sub-handoff')
      event.set('event_type', 'HANDOFF_CREATED')
      event.set('occurred_at', '2026-09-23T12:05:00.000Z')
      event.set('actor_id', 'synthetic')
      event.set('payload', { fixture: 'SPEC-3-001' })
      app.save(event)
    }

    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const appointmentRows = [
      {
        appointment_id: 'spec3001-appointment-reschedule',
        lead_submission_id: 'spec3001-sub-reschedule',
        status: 'CONCLUIDO',
        created_at: '2026-09-23T13:10:00.000Z',
        concluded_at: '2026-09-23T13:30:00.000Z',
        slot_id: '',
        slot_datetime: '2026-09-23T13:30:00.000Z',
        nome: 'Lead Sintético Reprocessamento',
        canal: 'canal-sintetico-05',
        localidade: 'residencial',
        profissao: 'Executivo/Gestor',
        objetivo: 'Melhorar a performance esportiva',
        proximidade: 'Moro no Itaigara ou em bairros vizinhos',
        ocupacao: 'Executivo/Gestor',
        interesse: 'Sim, quero agendar uma visita presencial',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'spec3001-reprocessamento',
        attribution_status: 'recebida',
        handoff_reason: '',
      },
      {
        appointment_id: 'spec3001-appointment-handoff',
        lead_submission_id: 'spec3001-sub-appt-handoff',
        status: 'ENCAMINHAMENTO_HUMANO',
        created_at: '2026-09-23T14:10:00.000Z',
        concluded_at: '',
        slot_id: '',
        slot_datetime: '2026-09-23T14:10:00.000Z',
        nome: 'Lead Sintético Handoff Agenda',
        canal: 'canal-sintetico-06',
        localidade: 'comercial',
        profissao: 'Autônomo/Empresário',
        objetivo: 'Recuperação de lesões',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'Autônomo/Empresário',
        interesse: 'Sim, quero agendar uma aula experimental',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'spec3001-handoff-agenda',
        attribution_status: 'recebida',
        handoff_reason: 'fixture sintética sem horário disponível',
      },
      {
        appointment_id: 'spec3001-appointment-orphan',
        lead_submission_id: 'spec3001-sub-does-not-exist',
        status: 'CONCLUIDO',
        created_at: '2026-09-23T15:00:00.000Z',
        concluded_at: '2026-09-23T15:20:00.000Z',
        slot_id: '',
        slot_datetime: '2026-09-23T15:20:00.000Z',
        nome: 'Lead Sintético Sem Vínculo',
        canal: 'canal-sintetico-orphan',
        localidade: 'residencial',
        profissao: 'Analista',
        objetivo: 'Emagrecimento',
        proximidade: 'Passo com frequência pela região',
        ocupacao: 'CLT',
        interesse: 'Sim, quero agendar uma visita presencial',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        attribution_status: '',
        handoff_reason: '',
      },
    ]
    for (const data of appointmentRows) {
      try {
        app.findFirstRecordByData('lead_appointments', 'appointment_id', data.appointment_id)
      } catch (_) {
        const appointment = new Record(appointments)
        appointment.set('appointment_id', data.appointment_id)
        appointment.set('lead_submission_id', data.lead_submission_id)
        appointment.set('form_id', 'fellice-captura-01')
        appointment.set('form_version', 'v1.0.0')
        appointment.set('slot_id', data.slot_id)
        appointment.set('slot_datetime', data.slot_datetime)
        appointment.set('slot_duration_min', 30)
        appointment.set('nome', data.nome)
        appointment.set('telefone_ou_canal_de_retorno', data.canal)
        appointment.set('localidade', data.localidade)
        appointment.set('profissao', data.profissao)
        appointment.set('email', '')
        appointment.set('status', data.status)
        appointment.set('conflict_detected', false)
        appointment.set('handoff_reason', data.handoff_reason)
        appointment.set('created_at', data.created_at)
        appointment.set('concluded_at', data.concluded_at)
        appointment.set('objetivo', data.objetivo)
        appointment.set('proximidade', data.proximidade)
        appointment.set('ocupacao', data.ocupacao)
        appointment.set('interesse_em_visita', data.interesse)
        appointment.set('utm_source', data.utm_source)
        appointment.set('utm_medium', data.utm_medium)
        appointment.set('utm_campaign', data.utm_campaign)
        appointment.set('attribution_status', data.attribution_status)
        app.save(appointment)
      }
    }

    const appointmentEvents = app.findCollectionByNameOrId('lead_appointment_events')
    const appointmentEventRows = [
      [
        'spec3001-appointment-event-created',
        'spec3001-appointment-reschedule',
        'spec3001-sub-reschedule',
        'APPOINTMENT_CREATED',
        '2026-09-23T13:10:00.000Z',
      ],
      [
        'spec3001-appointment-event-concluded-01',
        'spec3001-appointment-reschedule',
        'spec3001-sub-reschedule',
        'APPOINTMENT_CONCLUDED',
        '2026-09-23T13:30:00.000Z',
      ],
      [
        'spec3001-appointment-event-concluded-02',
        'spec3001-appointment-reschedule',
        'spec3001-sub-reschedule',
        'APPOINTMENT_CONCLUDED',
        '2026-09-23T13:31:00.000Z',
      ],
      [
        'spec3001-appointment-event-handoff-created',
        'spec3001-appointment-handoff',
        'spec3001-sub-appt-handoff',
        'APPOINTMENT_CREATED',
        '2026-09-23T14:10:00.000Z',
      ],
      [
        'spec3001-appointment-event-handoff',
        'spec3001-appointment-handoff',
        'spec3001-sub-appt-handoff',
        'APPOINTMENT_HANDOFF',
        '2026-09-23T14:11:00.000Z',
      ],
      [
        'spec3001-appointment-event-orphan-created',
        'spec3001-appointment-orphan',
        'spec3001-sub-does-not-exist',
        'APPOINTMENT_CREATED',
        '2026-09-23T15:00:00.000Z',
      ],
      [
        'spec3001-appointment-event-orphan-concluded',
        'spec3001-appointment-orphan',
        'spec3001-sub-does-not-exist',
        'APPOINTMENT_CONCLUDED',
        '2026-09-23T15:20:00.000Z',
      ],
    ]
    for (const [
      eventId,
      appointmentId,
      submissionId,
      eventType,
      occurredAt,
    ] of appointmentEventRows) {
      try {
        app.findFirstRecordByData('lead_appointment_events', 'event_id', eventId)
      } catch (_) {
        const event = new Record(appointmentEvents)
        event.set('event_id', eventId)
        event.set('appointment_id', appointmentId)
        event.set('lead_submission_id', submissionId)
        event.set('event_type', eventType)
        event.set('occurred_at', occurredAt)
        event.set('actor_id', 'synthetic')
        event.set('payload', { fixture: 'SPEC-3-001' })
        app.save(event)
      }
    }
  },
  (app) => {
    const deleteByData = (collection, field, values) => {
      for (const value of values) {
        try {
          app.delete(app.findFirstRecordByData(collection, field, value))
        } catch (_) {}
      }
    }
    deleteByData('lead_appointment_events', 'event_id', [
      'spec3001-appointment-event-created',
      'spec3001-appointment-event-concluded-01',
      'spec3001-appointment-event-concluded-02',
      'spec3001-appointment-event-handoff-created',
      'spec3001-appointment-event-handoff',
      'spec3001-appointment-event-orphan-created',
      'spec3001-appointment-event-orphan-concluded',
    ])
    deleteByData('lead_appointments', 'appointment_id', [
      'spec3001-appointment-reschedule',
      'spec3001-appointment-handoff',
      'spec3001-appointment-orphan',
    ])
    deleteByData('lead_handoff_events', 'event_id', ['spec3001-handoff-event-01'])
    deleteByData('lead_handoffs', 'handoff_id', ['spec3001-handoff-01'])
    deleteByData('lead_submission_events', 'event_id', [
      'spec3001-evt-start-complete',
      'spec3001-evt-triage-complete',
      'spec3001-evt-start-partial',
      'spec3001-evt-triage-partial',
      'spec3001-evt-start-absent',
      'spec3001-evt-start-handoff',
      'spec3001-evt-triage-handoff',
      'spec3001-evt-start-reschedule',
      'spec3001-evt-triage-reschedule',
      'spec3001-evt-start-appt-handoff',
      'spec3001-evt-triage-appt-handoff',
    ])
    deleteByData('lead_submissions', 'lead_submission_id', [
      'spec3001-sub-complete',
      'spec3001-sub-partial',
      'spec3001-sub-absent',
      'spec3001-sub-handoff',
      'spec3001-sub-reschedule',
      'spec3001-sub-appt-handoff',
    ])
  },
)
