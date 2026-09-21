// F2-IMP-009 — fixtures sintéticas temporárias para a consolidação do TDD da
// SPEC-2-002 (CA-2.06..CA-2.10) e usuários sintéticos de teste.
// Nenhuma alteração de schema ou de produto: apenas dados de prova removíveis.
// Todas as fixtures usam slot_id vazio (estados não ativos não ocupam vaga e a
// TENTATIVA sintética não toca na grade real). Remover após o aceite, no padrão 0046.

migrate(
  (app) => {
    // 1. Usuários sintéticos temporários (senhas não são credenciais reais).
    const users = app.findCollectionByNameOrId('users')
    const userFixtures = [
      {
        email: 'champion.f2imp009@fellice-fitness.local',
        role: 'champion',
        password: 'ChampionF2Imp009@2026',
      },
      {
        email: 'consultor.a.f2imp009@fellice-fitness.local',
        role: 'consultor',
        password: 'ConsultorAF2Imp009@2026',
      },
      {
        email: 'consultor.b.f2imp009@fellice-fitness.local',
        role: 'consultor',
        password: 'ConsultorBF2Imp009@2026',
      },
      {
        email: 'gestao.f2imp009@fellice-fitness.local',
        role: 'gestao',
        password: 'GestaoF2Imp009@2026',
      },
    ]
    for (const data of userFixtures) {
      try {
        app.findFirstRecordByData('users', 'email', data.email)
      } catch (_) {
        const user = new Record(users)
        user.set('email', data.email)
        user.set('role', data.role)
        user.setPassword(data.password)
        user.set('verified', true)
        app.save(user)
      }
    }

    const consultorAId = app.findFirstRecordByData(
      'users',
      'email',
      'consultor.a.f2imp009@fellice-fitness.local',
    ).id
    const consultorBId = app.findFirstRecordByData(
      'users',
      'email',
      'consultor.b.f2imp009@fellice-fitness.local',
    ).id

    // 2. Tentativas sintéticas em todos os estados da SPEC-2-002.
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const rows = [
      {
        appointment_id: 'appt-consol-009-tentativa',
        lead_submission_id: 'sub-consol-009-tentativa',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '2026-09-21 13:00:00.000Z',
        slot_duration_min: 30,
        nome: 'Lead Consolidação Tentativa',
        telefone_ou_canal_de_retorno: '+55 71 90000-0901',
        localidade: 'residencial',
        profissao: 'Analista (sintético)',
        email: '',
        status: 'TENTATIVA',
        conflict_detected: false,
        handoff_reason: '',
        created_at: '2026-09-21 12:55:00.000Z',
        objetivo: 'Emagrecimento',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'CLT',
        interesse_em_visita: 'Sim, quero agendar uma aula experimental',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'consolidacao-f2-009',
        attribution_status: 'recebida',
      },
      {
        appointment_id: 'appt-consol-009-concluido',
        lead_submission_id: 'sub-consol-009-concluido',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '2026-09-21 14:00:00.000Z',
        slot_duration_min: 30,
        nome: 'Lead Consolidação Concluído',
        telefone_ou_canal_de_retorno: '+55 71 90000-0902',
        localidade: 'comercial',
        profissao: 'Professor (sintético)',
        email: '',
        status: 'CONCLUIDO',
        conflict_detected: false,
        handoff_reason: '',
        created_at: '2026-09-21 13:20:00.000Z',
        concluded_at: '2026-09-21 13:30:00.000Z',
        objetivo: 'Ganho de massa muscular',
        proximidade: 'Moro no Itaigara ou bairros vizinhos',
        ocupacao: 'Autônomo/Empresário',
        interesse_em_visita: 'Sim, quero agendar uma visita presencial',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'consolidacao-f2-009',
        attribution_status: 'recebida',
      },
      {
        appointment_id: 'appt-consol-009-desistencia',
        lead_submission_id: 'sub-consol-009-desistencia',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '',
        slot_duration_min: 30,
        nome: 'Lead Consolidação Desistência',
        telefone_ou_canal_de_retorno: '+55 71 90000-0903',
        localidade: 'residencial',
        profissao: 'Estudante (sintético)',
        email: '',
        status: 'DESISTENCIA',
        conflict_detected: false,
        handoff_reason: '',
        created_at: '2026-09-21 13:40:00.000Z',
        objetivo: 'Condicionamento físico e resistência',
        proximidade: 'Passo com frequência pela região',
        ocupacao: 'Estudante',
        interesse_em_visita: 'Quero receber mais informações antes de decidir',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        attribution_status: 'ausente',
      },
      {
        appointment_id: 'appt-consol-009-handoff',
        lead_submission_id: 'sub-consol-009-handoff',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '',
        slot_duration_min: 30,
        nome: 'Lead Consolidação Encaminhamento',
        telefone_ou_canal_de_retorno: '+55 71 90000-0904',
        localidade: 'residencial',
        profissao: 'Enfermeiro (sintético)',
        email: '',
        status: 'ENCAMINHAMENTO_HUMANO',
        conflict_detected: false,
        handoff_reason: 'sem horário disponível (fixture F2-IMP-009)',
        created_at: '2026-09-21 10:30:00.000Z',
        objetivo: 'Saúde, mobilidade e qualidade de vida',
        proximidade: 'Moro/trabalho em outra região, mas me desloco para treinar',
        ocupacao: 'Profissional da saúde, educação ou outra área com horário irregular',
        interesse_em_visita: 'Sim, quero agendar uma aula experimental',
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: '',
        attribution_status: 'incompleta',
        turno_origem: 'MANHA',
        turno_fim_at: '2026-09-21 14:00:00.000Z',
      },
      {
        appointment_id: 'appt-consol-009-handoff-assumido',
        lead_submission_id: 'sub-consol-009-assumido',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '',
        slot_duration_min: 30,
        nome: 'Lead Consolidação Assumido',
        telefone_ou_canal_de_retorno: '+55 71 90000-0905',
        localidade: 'comercial',
        profissao: 'Vendedor (sintético)',
        email: '',
        status: 'ENCAMINHAMENTO_HUMANO',
        conflict_detected: false,
        handoff_reason: 'dúvida antes de agendar (fixture F2-IMP-009)',
        created_at: '2026-09-21 10:45:00.000Z',
        objetivo: 'Melhorar a performance esportiva',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'Executivo/Gestor',
        interesse_em_visita: 'Sim, quero agendar uma visita presencial',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'consolidacao-f2-009',
        attribution_status: 'recebida',
        dono: consultorAId,
        assumed_at: '2026-09-21 11:00:00.000Z',
        turno_origem: 'TARDE',
        turno_fim_at: '2026-09-21 19:00:00.000Z',
      },
      {
        appointment_id: 'appt-consol-009-fila',
        lead_submission_id: 'sub-consol-009-fila',
        form_id: 'fellice-captura-01',
        form_version: 'v1.0.0',
        slot_id: '',
        slot_datetime: '',
        slot_duration_min: 30,
        nome: 'Lead Consolidação Fila',
        telefone_ou_canal_de_retorno: '+55 71 90000-0906',
        localidade: 'residencial',
        profissao: 'Autônomo (sintético)',
        email: '',
        status: 'ENCAMINHAMENTO_HUMANO',
        conflict_detected: false,
        handoff_reason: 'falha de sistema no agendamento (fixture F2-IMP-009)',
        created_at: '2026-09-21 11:05:00.000Z',
        objetivo: 'Emagrecimento',
        proximidade: 'Moro no Itaigara ou bairros vizinhos',
        ocupacao: 'Autônomo/Empresário',
        interesse_em_visita: 'Ainda não defini meu objetivo',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'consolidacao-f2-009',
        attribution_status: 'recebida',
        turno_origem: 'TARDE',
        turno_fim_at: '2026-09-21 19:00:00.000Z',
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

    // 3. Trilha de eventos coerente com o estado de cada fixture.
    const events = app.findCollectionByNameOrId('lead_appointment_events')
    const eventRows = [
      [
        'evt-consol-009-tent',
        'appt-consol-009-tentativa',
        'sub-consol-009-tentativa',
        'APPOINTMENT_CREATED',
        '2026-09-21 12:55:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-conc',
        'appt-consol-009-concluido',
        'sub-consol-009-concluido',
        'APPOINTMENT_CREATED',
        '2026-09-21 13:20:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-conc2',
        'appt-consol-009-concluido',
        'sub-consol-009-concluido',
        'APPOINTMENT_CONCLUDED',
        '2026-09-21 13:30:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-desi',
        'appt-consol-009-desistencia',
        'sub-consol-009-desistencia',
        'APPOINTMENT_CREATED',
        '2026-09-21 13:40:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-desi2',
        'appt-consol-009-desistencia',
        'sub-consol-009-desistencia',
        'APPOINTMENT_ABANDONED',
        '2026-09-21 13:45:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-hand',
        'appt-consol-009-handoff',
        'sub-consol-009-handoff',
        'APPOINTMENT_CREATED',
        '2026-09-21 10:30:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-hand2',
        'appt-consol-009-handoff',
        'sub-consol-009-handoff',
        'APPOINTMENT_HANDOFF',
        '2026-09-21 10:31:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-assm',
        'appt-consol-009-handoff-assumido',
        'sub-consol-009-assumido',
        'APPOINTMENT_CREATED',
        '2026-09-21 10:45:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-assm2',
        'appt-consol-009-handoff-assumido',
        'sub-consol-009-assumido',
        'APPOINTMENT_HANDOFF',
        '2026-09-21 10:46:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-assm3',
        'appt-consol-009-handoff-assumido',
        'sub-consol-009-assumido',
        'APPOINTMENT_ASSUMED',
        '2026-09-21 11:00:00.000Z',
        consultorAId,
      ],
      [
        'evt-consol-009-fila',
        'appt-consol-009-fila',
        'sub-consol-009-fila',
        'APPOINTMENT_CREATED',
        '2026-09-21 11:05:00.000Z',
        'public',
      ],
      [
        'evt-consol-009-fila2',
        'appt-consol-009-fila',
        'sub-consol-009-fila',
        'APPOINTMENT_HANDOFF',
        '2026-09-21 11:06:00.000Z',
        'public',
      ],
    ]
    for (const [eventId, apptId, subId, type, occurredAt, actorId] of eventRows) {
      try {
        app.findFirstRecordByData('lead_appointment_events', 'event_id', eventId)
      } catch (_) {
        const event = new Record(events)
        event.set('event_id', eventId)
        event.set('appointment_id', apptId)
        event.set('lead_submission_id', subId)
        event.set('event_type', type)
        event.set('occurred_at', occurredAt)
        event.set('actor_id', actorId)
        event.set('payload', { fixture: 'F2-IMP-009' })
        app.save(event)
      }
    }
  },
  (app) => {
    const appointmentIds = [
      'appt-consol-009-tentativa',
      'appt-consol-009-concluido',
      'appt-consol-009-desistencia',
      'appt-consol-009-handoff',
      'appt-consol-009-handoff-assumido',
      'appt-consol-009-fila',
    ]
    for (const appointmentId of appointmentIds) {
      try {
        app.delete(
          app.findFirstRecordByData('lead_appointment_events', 'appointment_id', appointmentId),
        )
      } catch (_) {}
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', appointmentId))
      } catch (_) {}
    }
    const emails = [
      'champion.f2imp009@fellice-fitness.local',
      'consultor.a.f2imp009@fellice-fitness.local',
      'consultor.b.f2imp009@fellice-fitness.local',
      'gestao.f2imp009@fellice-fitness.local',
    ]
    for (const email of emails) {
      try {
        app.delete(app.findFirstRecordByData('users', 'email', email))
      } catch (_) {}
    }
  },
)
