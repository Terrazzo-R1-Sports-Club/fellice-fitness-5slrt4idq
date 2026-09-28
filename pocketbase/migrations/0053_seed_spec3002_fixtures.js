// Fase 3 / SPEC-3-002 — fixtures sintéticas para comparação e vigência.
// Usa um formulário fixture isolado: v1 esteve vigente antes da publicação de v2.
// Não cria contas nem credenciais. Nenhuma fixture contém contato real.

migrate(
  (app) => {
    const formId = 'spec3002-dashboard-form'
    const form = app.findCollectionByNameOrId('lead_forms')
    try {
      app.findFirstRecordByData('lead_forms', 'form_id', formId)
    } catch (_) {
      const record = new Record(form)
      record.set('form_id', formId)
      record.set('name', 'Fixture comparativo SPEC-3-002')
      record.set('slug', 'fixture-dashboard-spec-3-002')
      record.set('active_version', 'spec3002-v2')
      record.set('description', 'Dados sintéticos para validar comparativo por vigência.')
      app.save(record)
    }

    const versions = app.findCollectionByNameOrId('lead_form_versions')
    const versionRows = [
      {
        version: 'spec3002-v1',
        status: 'DESATIVADA',
        published_at: '2026-09-10T00:00:00.000Z',
      },
      {
        version: 'spec3002-v2',
        status: 'ATIVA',
        published_at: '2026-09-20T00:00:00.000Z',
      },
    ]
    for (const data of versionRows) {
      try {
        app.findFirstRecordByData('lead_form_versions', 'form_version', data.version)
      } catch (_) {
        const record = new Record(versions)
        record.set('form_id', formId)
        record.set('form_version', data.version)
        record.set('status', data.status)
        record.set('published_at', data.published_at)
        record.set('field_contract', {
          nome: { required: true },
          canal_de_retorno: { required: true },
          proximidade: { required: true },
          objetivo: { required: true },
          ocupacao: { required: false },
          interesse_em_visita: { required: true },
          precisa_de_ajuda_humana: { required: false },
        })
        app.save(record)
      }
    }

    const submissions = app.findCollectionByNameOrId('lead_submissions')
    const submissionRows = [
      {
        id: 'spec3002-sub-v1-01',
        version: 'spec3002-v1',
        started_at: '2026-09-15T09:00:00.000Z',
        submitted_at: '2026-09-15T09:04:00.000Z',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'spec3002-verao-01',
        attribution_status: 'recebida',
        triage: 'TRIAGEM_CONCLUIDA',
        objetivo: 'Emagrecimento',
        proximidade: 'Moro no Itaigara ou em bairros vizinhos',
        ocupacao: 'CLT',
        interesse: 'Sim, quero agendar uma visita presencial',
      },
      {
        id: 'spec3002-sub-v1-02',
        version: 'spec3002-v1',
        started_at: '2026-09-17T10:00:00.000Z',
        submitted_at: '2026-09-17T10:04:00.000Z',
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: '',
        attribution_status: 'incompleta',
        triage: 'TRIAGEM_CONCLUIDA',
        objetivo: 'Ganho de massa muscular',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'Autônomo/Empresário',
        interesse: 'Sim, quero agendar uma aula experimental',
      },
      {
        id: 'spec3002-sub-v1-03',
        version: 'spec3002-v1',
        started_at: '2026-09-18T11:00:00.000Z',
        submitted_at: '',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        attribution_status: 'ausente',
        triage: 'EM_ANDAMENTO',
        objetivo: 'Condicionamento físico e resistência',
        proximidade: 'Passo com frequência pela região',
        ocupacao: 'Estudante',
        interesse: 'Quero receber mais informações antes de decidir',
      },
      {
        id: 'spec3002-sub-v2-01',
        version: 'spec3002-v2',
        started_at: '2026-09-21T09:00:00.000Z',
        submitted_at: '2026-09-21T09:04:00.000Z',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'spec3002-verao-01',
        attribution_status: 'recebida',
        triage: 'TRIAGEM_CONCLUIDA',
        objetivo: 'Saúde, mobilidade e qualidade de vida',
        proximidade: 'Moro no Itaigara ou em bairros vizinhos',
        ocupacao: 'Executivo/Gestor',
        interesse: 'Sim, quero agendar uma aula experimental',
      },
      {
        id: 'spec3002-sub-v2-02',
        version: 'spec3002-v2',
        started_at: '2026-09-22T12:00:00.000Z',
        submitted_at: '2026-09-22T12:04:00.000Z',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'spec3002-outono-02',
        attribution_status: 'recebida',
        triage: 'TRIAGEM_CONCLUIDA',
        objetivo: 'Recuperação de lesões',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'Autônomo/Empresário',
        interesse: 'Sim, quero agendar uma visita presencial',
      },
      {
        id: 'spec3002-sub-v2-03',
        version: 'spec3002-v2',
        started_at: '2026-09-23T13:00:00.000Z',
        submitted_at: '2026-09-23T13:04:00.000Z',
        utm_source: 'origem-sintetica-nao-classificada',
        utm_medium: 'medio-sintetico',
        utm_campaign: '',
        attribution_status: 'incompleta',
        triage: 'TRIAGEM_CONCLUIDA',
        objetivo: 'Emagrecimento',
        proximidade: 'Moro no Itaigara ou em bairros vizinhos',
        ocupacao: 'CLT',
        interesse: 'Sim, quero agendar uma aula experimental',
      },
    ]
    for (const data of submissionRows) {
      try {
        app.findFirstRecordByData('lead_submissions', 'lead_submission_id', data.id)
      } catch (_) {
        const record = new Record(submissions)
        record.set('lead_submission_id', data.id)
        record.set('form_id', formId)
        record.set('form_version', data.version)
        record.set('started_at', data.started_at)
        record.set('submitted_at', data.submitted_at)
        record.set('nome', `Fixture sintética ${data.version}`)
        record.set('canal_de_retorno', 'fixture-sem-contato-real')
        record.set('objetivo', data.objetivo)
        record.set('proximidade', data.proximidade)
        record.set('ocupacao', data.ocupacao)
        record.set('interesse_em_visita', data.interesse)
        record.set('precisa_de_ajuda_humana', false)
        record.set('utm_source', data.utm_source)
        record.set('utm_medium', data.utm_medium)
        record.set('utm_campaign', data.utm_campaign)
        record.set('attribution_status', data.attribution_status)
        record.set('triagem_status', data.triage)
        // Fixture sem pessoa real: não declarar consentimento operacional.
        app.save(record)
      }
    }

    const submissionEvents = app.findCollectionByNameOrId('lead_submission_events')
    const submissionEventRows = []
    for (const data of submissionRows) {
      submissionEventRows.push([
        `spec3002-${data.id}-started`,
        data.id,
        'FORM_STARTED',
        data.started_at,
      ])
      if (data.triage === 'TRIAGEM_CONCLUIDA') {
        submissionEventRows.push([
          `spec3002-${data.id}-triage`,
          data.id,
          'TRIAGEM_CONCLUIDA',
          data.submitted_at,
        ])
      }
    }
    for (const [eventId, submissionId, eventType, occurredAt] of submissionEventRows) {
      try {
        app.findFirstRecordByData('lead_submission_events', 'event_id', eventId)
      } catch (_) {
        const event = new Record(submissionEvents)
        event.set('event_id', eventId)
        event.set('lead_submission_id', submissionId)
        event.set('event_type', eventType)
        event.set('occurred_at', occurredAt)
        event.set('payload', { fixture: 'SPEC-3-002' })
        app.save(event)
      }
    }

    const handoffs = app.findCollectionByNameOrId('lead_handoffs')
    const handoffRows = [
      {
        id: 'spec3002-handoff-v1',
        submission: 'spec3002-sub-v1-01',
        at: '2026-09-15T09:10:00.000Z',
      },
      {
        id: 'spec3002-handoff-v2',
        submission: 'spec3002-sub-v2-01',
        at: '2026-09-21T09:10:00.000Z',
      },
    ]
    for (const data of handoffRows) {
      try {
        app.findFirstRecordByData('lead_handoffs', 'handoff_id', data.id)
      } catch (_) {
        const submission = app.findFirstRecordByData(
          'lead_submissions',
          'lead_submission_id',
          data.submission,
        )
        const handoff = new Record(handoffs)
        handoff.set('handoff_id', data.id)
        handoff.set('lead_submission_id', data.submission)
        handoff.set('form_id', formId)
        handoff.set('form_version', submission.getString('form_version', ''))
        handoff.set('created_at', data.at)
        handoff.set('motivo', 'fixture sintética SPEC-3-002')
        handoff.set('nome', 'Fixture sintética')
        handoff.set('canal_de_retorno', 'fixture-sem-contato-real')
        handoff.set('objetivo', submission.getString('objetivo', ''))
        handoff.set('proximidade', submission.getString('proximidade', ''))
        handoff.set('ocupacao', submission.getString('ocupacao', ''))
        handoff.set('interesse_em_visita', submission.getString('interesse_em_visita', ''))
        handoff.set('utm_source', submission.getString('utm_source', ''))
        handoff.set('utm_medium', submission.getString('utm_medium', ''))
        handoff.set('utm_campaign', submission.getString('utm_campaign', ''))
        handoff.set('attribution_status', submission.getString('attribution_status', ''))
        handoff.set('status', 'PENDENTE')
        app.save(handoff)
      }
    }

    const handoffEvents = app.findCollectionByNameOrId('lead_handoff_events')
    for (const data of handoffRows) {
      const eventId = `${data.id}-event`
      try {
        app.findFirstRecordByData('lead_handoff_events', 'event_id', eventId)
      } catch (_) {
        const event = new Record(handoffEvents)
        event.set('event_id', eventId)
        event.set('handoff_id', data.id)
        event.set('lead_submission_id', data.submission)
        event.set('event_type', 'HANDOFF_CREATED')
        event.set('occurred_at', data.at)
        event.set('actor_id', 'synthetic')
        event.set('payload', { fixture: 'SPEC-3-002' })
        app.save(event)
      }
    }

    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const appointmentRows = [
      {
        id: 'spec3002-appointment-v1',
        submission: 'spec3002-sub-v1-01',
        status: 'CONCLUIDO',
        created: '2026-09-15T09:20:00.000Z',
        concluded: '2026-09-15T09:40:00.000Z',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'spec3002-verao-01',
      },
      {
        id: 'spec3002-appointment-v2',
        submission: 'spec3002-sub-v2-01',
        status: 'CONCLUIDO',
        created: '2026-09-21T09:20:00.000Z',
        concluded: '2026-09-21T09:40:00.000Z',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'spec3002-verao-01',
      },
      {
        id: 'spec3002-appointment-orphan',
        submission: 'spec3002-sub-does-not-exist',
        status: 'CONCLUIDO',
        created: '2026-09-23T15:00:00.000Z',
        concluded: '2026-09-23T15:20:00.000Z',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'spec3002-orphan-must-not-attribute',
      },
    ]
    for (const data of appointmentRows) {
      try {
        app.findFirstRecordByData('lead_appointments', 'appointment_id', data.id)
      } catch (_) {
        const isOrphan = data.id === 'spec3002-appointment-orphan'
        const submission = isOrphan
          ? null
          : app.findFirstRecordByData('lead_submissions', 'lead_submission_id', data.submission)
        const appointment = new Record(appointments)
        appointment.set('appointment_id', data.id)
        appointment.set('lead_submission_id', data.submission)
        appointment.set('form_id', formId)
        appointment.set(
          'form_version',
          submission ? submission.getString('form_version', '') : 'spec3002-v2',
        )
        appointment.set('slot_id', '')
        appointment.set('slot_datetime', data.concluded)
        appointment.set('slot_duration_min', 30)
        appointment.set('nome', 'Fixture sintética')
        appointment.set('telefone_ou_canal_de_retorno', 'fixture-sem-contato-real')
        appointment.set('localidade', 'fixture')
        appointment.set('profissao', 'fixture')
        appointment.set('email', '')
        appointment.set('status', data.status)
        appointment.set('conflict_detected', false)
        appointment.set('handoff_reason', '')
        appointment.set('created_at', data.created)
        appointment.set('concluded_at', data.concluded)
        appointment.set(
          'objetivo',
          submission ? submission.getString('objetivo', '') : 'Emagrecimento',
        )
        appointment.set(
          'proximidade',
          submission
            ? submission.getString('proximidade', '')
            : 'Moro no Itaigara ou em bairros vizinhos',
        )
        appointment.set('ocupacao', submission ? submission.getString('ocupacao', '') : 'CLT')
        appointment.set(
          'interesse_em_visita',
          submission
            ? submission.getString('interesse_em_visita', '')
            : 'Sim, quero agendar uma visita presencial',
        )
        appointment.set('utm_source', data.utm_source)
        appointment.set('utm_medium', data.utm_medium)
        appointment.set('utm_campaign', data.utm_campaign)
        appointment.set(
          'attribution_status',
          submission ? submission.getString('attribution_status', '') : '',
        )
        app.save(appointment)
      }
    }

    const appointmentEvents = app.findCollectionByNameOrId('lead_appointment_events')
    for (const data of appointmentRows) {
      const eventId = `${data.id}-concluded-event`
      try {
        app.findFirstRecordByData('lead_appointment_events', 'event_id', eventId)
      } catch (_) {
        const event = new Record(appointmentEvents)
        event.set('event_id', eventId)
        event.set('appointment_id', data.id)
        event.set('lead_submission_id', data.submission)
        event.set('event_type', 'APPOINTMENT_CONCLUDED')
        event.set('occurred_at', data.concluded)
        event.set('actor_id', 'synthetic')
        event.set('payload', { fixture: 'SPEC-3-002' })
        app.save(event)
      }
    }
  },
  (app) => {
    const removeBy = (collection, field, value) => {
      try {
        app.delete(app.findFirstRecordByData(collection, field, value))
      } catch (_) {}
    }

    const appointmentIds = [
      'spec3002-appointment-v1',
      'spec3002-appointment-v2',
      'spec3002-appointment-orphan',
    ]
    for (const id of appointmentIds) {
      removeBy('lead_appointment_events', 'event_id', `${id}-concluded-event`)
      removeBy('lead_appointments', 'appointment_id', id)
    }

    const handoffIds = ['spec3002-handoff-v1', 'spec3002-handoff-v2']
    for (const id of handoffIds) {
      removeBy('lead_handoff_events', 'event_id', `${id}-event`)
      removeBy('lead_handoffs', 'handoff_id', id)
    }

    const submissionIds = [
      'spec3002-sub-v1-01',
      'spec3002-sub-v1-02',
      'spec3002-sub-v1-03',
      'spec3002-sub-v2-01',
      'spec3002-sub-v2-02',
      'spec3002-sub-v2-03',
    ]
    for (const id of submissionIds) {
      removeBy('lead_submission_events', 'event_id', `spec3002-${id}-started`)
      removeBy('lead_submission_events', 'event_id', `spec3002-${id}-triage`)
      removeBy('lead_submissions', 'lead_submission_id', id)
    }

    removeBy('lead_form_versions', 'form_version', 'spec3002-v1')
    removeBy('lead_form_versions', 'form_version', 'spec3002-v2')
    removeBy('lead_forms', 'form_id', 'spec3002-dashboard-form')
  },
)
