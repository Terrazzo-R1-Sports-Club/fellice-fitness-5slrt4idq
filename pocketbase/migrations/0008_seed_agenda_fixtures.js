// F2-IMP-001 — seed das fixtures sintéticas da SPEC-2-001 no ambiente de teste.
// Os dados espelham pocketbase/fixtures/agenda.fixtures.js (definição canônica — alterar lá primeiro).
// Idempotente: só cria o registro se ele ainda não existir (padrão da migração 0003).
// 100% sintético — "Lead Teste B", telefones fictícios. Nenhum dado real.
// Down-migration remove exatamente os registros criados aqui, sem tocar em mais nada.

migrate(
  (app) => {
    const slots = app.findCollectionByNameOrId('agenda_slots')
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const events = app.findCollectionByNameOrId('lead_appointment_events')

    const upsert = (collection, uniqueField, uniqueValue, data) => {
      try {
        app.findFirstRecordByData(collection.name, uniqueField, uniqueValue)
      } catch (_) {
        const record = new Record(collection)
        // JSVM do PocketBase: set exige (chave, valor); objeto único é ignorado
        // (causa raiz do erro "Cannot be blank" do build anterior).
        Object.entries(data).forEach(([key, value]) => record.set(key, value))
        app.save(record)
      }
    }

    // ----- slots -----
    upsert(slots, 'slot_id', 'slot-teste-cap1-0830', {
      slot_id: 'slot-teste-cap1-0830',
      slot_datetime: '2026-09-21 08:30:00.000Z',
      slot_duration_min: 30,
      capacity: 1,
      status: 'ABERTO',
      created_by: 'fixture',
    })
    upsert(slots, 'slot_id', 'slot-teste-cap2-1200', {
      slot_id: 'slot-teste-cap2-1200',
      slot_datetime: '2026-09-21 12:00:00.000Z',
      slot_duration_min: 30,
      capacity: 2,
      status: 'ABERTO',
      created_by: 'fixture',
    })
    upsert(slots, 'slot_id', 'slot-teste-bloqueado-1700', {
      slot_id: 'slot-teste-bloqueado-1700',
      slot_datetime: '2026-09-21 17:00:00.000Z',
      slot_duration_min: 30,
      capacity: 1,
      status: 'BLOQUEADO',
      created_by: 'fixture',
    })

    // ----- tentativas -----
    upsert(appointments, 'appointment_id', 'appt-teste-0001', {
      appointment_id: 'appt-teste-0001',
      lead_submission_id: 'sub-teste-0001',
      form_id: 'fellice-captura-01',
      form_version: 'v1.0.0',
      slot_id: 'slot-teste-cap1-0830',
      slot_datetime: '2026-09-21 08:30:00.000Z',
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
      slot_id: 'slot-teste-cap2-1200',
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
      slot_id: 'slot-teste-cap1-0830',
      slot_datetime: '2026-09-21 08:30:00.000Z',
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

    // ----- eventos -----
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
  },
  (app) => {
    const remove = (collection, field, value) => {
      try {
        app.delete(app.findFirstRecordByData(collection, field, value))
      } catch (_) {}
    }
    remove('lead_appointment_events', 'event_id', 'evt-teste-0001')
    remove('lead_appointment_events', 'event_id', 'evt-teste-0002')
    remove('lead_appointment_events', 'event_id', 'evt-teste-0003')
    remove('lead_appointment_events', 'event_id', 'evt-teste-0004')
    remove('lead_appointments', 'appointment_id', 'appt-teste-0001')
    remove('lead_appointments', 'appointment_id', 'appt-teste-0002')
    remove('lead_appointments', 'appointment_id', 'appt-teste-0003')
    remove('lead_appointments', 'appointment_id', 'appt-teste-0004')
    remove('agenda_slots', 'slot_id', 'slot-teste-cap1-0830')
    remove('agenda_slots', 'slot_id', 'slot-teste-cap2-1200')
    remove('agenda_slots', 'slot_id', 'slot-teste-bloqueado-1700')
  },
)
