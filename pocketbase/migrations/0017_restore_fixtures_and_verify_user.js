// F2-IMP-004 — consolidação do estado pós-prova de rollback.
// O rollback de prova (revertido até 0013) deixou 0014/0015/0016 pendentes na plataforma.
// Esta migração recria o usuário de verificação (necessário para as provas de leitura) e
// re-semeia as fixtures da 0008 que foram removidas pelo down do rollback.
// O par 0014/0015 pendente é superseded por esta migração; a limpeza final do usuário
// de verificação acontece na 0018.

migrate(
  (app) => {
    // 1. re-semeia as fixtures da 0008 (o down do rollback as removeu)
    const slots = app.findCollectionByNameOrId('agenda_slots')
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const events = app.findCollectionByNameOrId('lead_appointment_events')

    const upsert = (collection, uniqueField, uniqueValue, data) => {
      try {
        app.findFirstRecordByData(collection.name, uniqueField, uniqueValue)
      } catch (_) {
        const record = new Record(collection)
        Object.entries(data).forEach(([key, value]) => record.set(key, value))
        app.save(record)
      }
    }

    upsert(appointments, 'appointment_id', 'appt-teste-0001', {
      appointment_id: 'appt-teste-0001',
      lead_submission_id: 'sub-teste-0001',
      form_id: 'fellice-captura-01',
      form_version: 'v1.0.0',
      slot_id: 'slot-2026-09-21-0800',
      slot_datetime: '2026-09-21 08:00:00.000Z',
      slot_duration_min: 30,
      nome: 'Lead Teste B',
      telefone_ou_canal_de_retorno: '+55 71 90000-0000',
      localidade: 'residencial',
      profissao: 'Analista (sintético)',
      email: '',
      status: 'TENTATIVA',
      conflict_detected: false,
      created_at: '2026-09-21 08:05:00.000Z',
    })
    upsert(appointments, 'appointment_id', 'appt-teste-0002', {
      appointment_id: 'appt-teste-0002',
      lead_submission_id: 'sub-teste-0002',
      form_id: 'fellice-captura-01',
      form_version: 'v1.0.0',
      slot_id: 'slot-2026-09-21-1200',
      slot_datetime: '2026-09-21 12:00:00.000Z',
      slot_duration_min: 30,
      nome: 'Lead Teste B',
      telefone_ou_canal_de_retorno: '+55 71 90000-0001',
      localidade: '',
      profissao: '',
      email: '',
      status: 'TENTATIVA',
      conflict_detected: false,
      created_at: '2026-09-21 08:10:00.000Z',
    })
    upsert(appointments, 'appointment_id', 'appt-teste-0003', {
      appointment_id: 'appt-teste-0003',
      lead_submission_id: 'sub-teste-0003',
      form_id: 'fellice-captura-01',
      form_version: 'v1.0.0',
      slot_id: 'slot-2026-09-21-0800',
      slot_datetime: '2026-09-21 08:00:00.000Z',
      slot_duration_min: 30,
      nome: 'Lead Teste B',
      telefone_ou_canal_de_retorno: '+55 71 90000-0002',
      localidade: 'comercial',
      profissao: 'Professor (sintético)',
      email: '',
      status: 'DESISTENCIA',
      conflict_detected: false,
      created_at: '2026-09-21 08:15:00.000Z',
    })
    upsert(appointments, 'appointment_id', 'appt-teste-0004', {
      appointment_id: 'appt-teste-0004',
      lead_submission_id: 'sub-teste-0004',
      form_id: 'fellice-captura-01',
      form_version: 'v1.0.0',
      slot_id: '',
      slot_datetime: '2026-09-21 17:00:00.000Z',
      slot_duration_min: 30,
      nome: 'Lead Teste B',
      telefone_ou_canal_de_retorno: '+55 71 90000-0003',
      localidade: 'residencial',
      profissao: 'Enfermeira (sintético)',
      email: '',
      status: 'ENCAMINHAMENTO_HUMANO',
      conflict_detected: false,
      handoff_reason: 'sem slots disponíveis (sintético)',
      created_at: '2026-09-21 08:20:00.000Z',
    })
    upsert(events, 'event_id', 'evt-teste-0001', {
      event_id: 'evt-teste-0001',
      appointment_id: 'appt-teste-0001',
      lead_submission_id: 'sub-teste-0001',
      event_type: 'APPOINTMENT_CREATED',
      occurred_at: '2026-09-21 08:05:00.000Z',
      actor_id: 'public',
      payload: { fixture: 'lead_valido_slot_disponivel' },
    })
    upsert(events, 'event_id', 'evt-teste-0002', {
      event_id: 'evt-teste-0002',
      appointment_id: 'appt-teste-0002',
      lead_submission_id: 'sub-teste-0002',
      event_type: 'APPOINTMENT_CREATED',
      occurred_at: '2026-09-21 08:10:00.000Z',
      actor_id: 'public',
      payload: { fixture: 'lead_campos_ausentes' },
    })
    upsert(events, 'event_id', 'evt-teste-0003', {
      event_id: 'evt-teste-0003',
      appointment_id: 'appt-teste-0003',
      lead_submission_id: 'sub-teste-0003',
      event_type: 'APPOINTMENT_ABANDONED',
      occurred_at: '2026-09-21 08:16:00.000Z',
      actor_id: 'public',
      payload: { fixture: 'tentativa_desistencia' },
    })
    upsert(events, 'event_id', 'evt-teste-0004', {
      event_id: 'evt-teste-0004',
      appointment_id: 'appt-teste-0004',
      lead_submission_id: 'sub-teste-0004',
      event_type: 'APPOINTMENT_HANDOFF',
      occurred_at: '2026-09-21 08:20:00.000Z',
      actor_id: 'public',
      payload: { fixture: 'tentativa_handoff' },
    })

    // 2. recria o usuário de verificação (para o teste humano da F2-IMP-004)
    const users = app.findCollectionByNameOrId('users')
    try {
      app.findFirstRecordByData('users', 'email', 'verifica.teste@fellice-fitness.local')
    } catch (_) {
      const user = new Record(users)
      user.set('email', 'verifica.teste@fellice-fitness.local')
      user.setPassword('VerificaTeste@2026')
      user.set('role', 'consultor')
      user.set('name', 'Verificação de Teste')
      user.set('verified', true)
      app.save(user)
    }
  },
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('users', 'email', 'verifica.teste@fellice-fitness.local'),
      )
    } catch (_) {}
  },
)
