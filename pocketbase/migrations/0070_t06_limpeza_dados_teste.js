// T06 (Fase 5) / veredito T05 (D2) + confirmação do Champion em 26/11/2026
// registrada em 04_fase-atual/t06-confirmacoes-recebidas.md:
//
//   "parte 1 - todos os registros são testes, podem ser apagados, não são
//    dados reais, estava apenas testando o sistema"
//
// Esta migração remove os dados de teste do banco. Vai em MIGRAÇÃO (e não em
// limpeza manual pelo painel) por uma razão técnica: as migrações de seed
// 0051_seed_spec3001_fixtures e 0053_seed_spec3002_fixtures CRIAM essas
// fixtures ao rodar. Numa base nova — como a de produção — elas voltariam a
// existir se a limpeza fosse só manual. Como esta migração tem ordinal maior
// (0070 > 0053), ela roda depois dos seeds e o resultado final é banco limpo.
//
// Mesmo padrão da 0069 (limpeza de fixture por decisão registrada).
//
// O que sai:
//   - 17 agendamentos de teste (fixtures SPEC-3, testes F2, provas humanas,
//     probes REF-06, fixture REF-09, regressão REF-11) + seus eventos;
//   - 12 encaminhamentos humanos de teste + seus eventos;
//   - 24 submissões referenciadas por esses registros + seus eventos;
//   - a ocupação (agenda_slot_occupancy) desses slots volta a 0;
//   - o usuário de teste teste.r1@fellice-fitness.local (criado pela 0061).
//
// O que NÃO sai: agenda_slots (a grade é tratada na 0071), settings de fila e
// funil, contas permanentes (gerencia@, r1@, administracao@).
//
// Idempotente: procura por chave de negócio e apaga se existir; numa base já
// limpa não encontra nada e não falha.

const APPOINTMENT_IDS = [
  '089f82cb-5a50-4c2a-8f55-a4518e4ae577',
  '9ca3d303-382d-4a98-8705-fed6f8d740cc',
  'appt-teste-0001',
  'appt-teste-0002',
  'appt-teste-0003',
  'appt-teste-0004',
  'cd255578-52aa-4988-a8ab-95b4b882bc18',
  'f5f85d93-9b6e-42cb-8f03-2dad78c8a2f4',
  'ref06-probe-a',
  'ref06-probe-d',
  'ref09-apt-0001',
  'spec3001-appointment-handoff',
  'spec3001-appointment-orphan',
  'spec3001-appointment-reschedule',
  'spec3002-appointment-orphan',
  'spec3002-appointment-v1',
  'spec3002-appointment-v2',
]

const HANDOFF_IDS = [
  '5d63de6b-f894-4025-ab00-aff76eb68585',
  'b416806b-efb8-4f4b-b36e-be7bee40f229',
  '1fd970ff-5c4b-41d1-bfb9-f04028bf8ee4',
  '6b4f90ff-6d12-4ba8-8593-85bc763f4e49',
  'b6b8a917-fa42-4c4a-ba58-553539541191',
  '739485bc-1d6e-491f-93ca-e660f44312e1',
  'd6cc3b99-a635-474c-84ae-49d84af9c6d5',
  '82bc679d-a59b-446d-bbe8-161d48c56b7d',
  '6102ae3d-c18a-45e8-9b2e-adf9911fdc73',
  'spec3001-handoff-01',
  'spec3002-handoff-v1',
  'spec3002-handoff-v2',
]

const SUBMISSION_IDS = [
  '017562f5-b4a6-410a-9740-a72ea299abd2',
  '09252c24-c8f8-4894-9dff-ae67841ebb4d',
  '20f53b49-6860-4b6b-a944-fabdf8a95c2e',
  '2c03ba42-4f40-4125-8d3e-356af5c3801a',
  '4e95857b-a8a6-46ed-8225-083ae50ffc25',
  '55499ea1-d5f8-4a56-be1b-6d5a238bfe7b',
  '6f1b4f5a-fc78-44b0-92b3-09d4043d8e17',
  '73891cf6-2275-4a36-9101-4d9e5379a30d',
  '76ddb342-9b0c-45f6-95a2-f0f2dc1d2386',
  'b23afcd4-7ba2-4885-88e9-da51f935633c',
  'bfd147ef-63e2-485b-bef1-e64b9e0097fe',
  'f7f5526d-b926-414f-95f2-007faf2c9dd7',
  'ref09-appt-probe-0002',
  'spec3001-sub-appt-handoff',
  'spec3001-sub-does-not-exist',
  'spec3001-sub-handoff',
  'spec3001-sub-reschedule',
  'spec3002-sub-does-not-exist',
  'spec3002-sub-v1-01',
  'spec3002-sub-v2-01',
  'sub-teste-0001',
  'sub-teste-0002',
  'sub-teste-0003',
  'sub-teste-0004',
]

// prefixos das submissões de teste que não estão na lista explícita
const SUBMISSION_PREFIXES = [
  'spec3001-sub-',
  'spec3002-sub-',
  'sub-teste-',
  'ref09-',
  'ref06-',
  'ref11-',
]

migrate(
  (app) => {
    const deleteByFilter = (collection, filter, params) => {
      try {
        const records = app.findRecordsByFilter(collection, filter, '', 0, 0, params || {})
        for (const record of records) {
          try {
            app.delete(record)
          } catch (_) {}
        }
      } catch (_) {}
    }

    // 1. agendamentos de teste + eventos
    for (const appointmentId of APPOINTMENT_IDS) {
      deleteByFilter('lead_appointment_events', 'appointment_id = {:a}', { a: appointmentId })
      deleteByFilter('lead_appointments', 'appointment_id = {:a}', { a: appointmentId })
    }

    // 2. encaminhamentos de teste + eventos
    for (const handoffId of HANDOFF_IDS) {
      deleteByFilter('lead_handoff_events', 'handoff_id = {:h}', { h: handoffId })
      deleteByFilter('lead_handoffs', 'handoff_id = {:h}', { h: handoffId })
    }

    // 3. submissões de teste + eventos
    const submissionIds = SUBMISSION_IDS.slice()
    const seen = {}
    submissionIds.forEach((id) => {
      seen[id] = true
    })
    for (const prefix of SUBMISSION_PREFIXES) {
      try {
        const extra = app.findRecordsByFilter(
          'lead_submissions',
          'lead_submission_id ~ {:p}',
          '',
          0,
          0,
          { p: prefix },
        )
        for (const record of extra) {
          const id = record.getString('lead_submission_id', '').trim()
          if (id && !seen[id]) {
            seen[id] = true
            submissionIds.push(id)
          }
        }
      } catch (_) {}
    }
    for (const submissionId of submissionIds) {
      deleteByFilter('lead_submission_events', 'lead_submission_id = {:s}', { s: submissionId })
      deleteByFilter('lead_submissions', 'lead_submission_id = {:s}', { s: submissionId })
    }

    // 4. eventos de agendamento órfãos das fixtures antigas (por prefixo)
    for (const prefix of ['spec3001-', 'spec3002-', 'appt-teste-', 'ref06-', 'ref09-']) {
      deleteByFilter('lead_appointment_events', 'event_id ~ {:p}', { p: prefix })
      deleteByFilter('lead_appointment_events', 'appointment_id ~ {:p}', { p: prefix })
      deleteByFilter('lead_handoff_events', 'event_id ~ {:p}', { p: prefix })
      deleteByFilter('lead_handoff_events', 'handoff_id ~ {:p}', { p: prefix })
    }

    // 5. ocupação volta a zero (a grade em si é tratada na 0071)
    try {
      const occupancies = app.findRecordsByFilter('agenda_slot_occupancy', 'active > 0', '', 0, 0)
      for (const record of occupancies) {
        record.set('active', 0)
        app.save(record)
      }
    } catch (_) {}

    // 6. usuário de teste (0061) — as contas permanentes NÃO são tocadas
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 'teste.r1@fellice-fitness.local'))
    } catch (_) {}
  },
  (app) => {
    // rollback: os dados apagados eram fixtures de teste e não são restaurados.
    // Restaurá-los exigiria reexecutar os seeds 0051/0053 com os mesmos ids;
    // como o valor deles é apenas de teste, o down é vazio (padrão 0069).
  },
)
