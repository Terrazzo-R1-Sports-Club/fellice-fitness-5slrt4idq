// F2-IMP-001 — fixtures sintéticas da SPEC-2-001.
// 100% sintéticas — nenhum dado pessoal real. "Lead Teste B" e telefone fictício,
// conforme exigência da SPEC ("Dados/fixtures").
//
// Matriz caminho da SPEC-2-001 ↔ fixture ↔ teste (rastreabilidade para aceite do Champion):
//
// | Caminho da SPEC-2-001          | Fixture                      | Teste (RED/GREEN)     |
// |--------------------------------|------------------------------|-----------------------|
// | Principal (RN-2.01→2.03)       | lead_valido_slot_disponivel  | T1 GREEN              |
// | Campos mínimos ausentes        | lead_campos_ausentes         | T2 RED deliberado     |
// | Slot indisponível (RN-2.01)    | slot_bloqueado               | T3 GREEN              |
// | Capacidade 2 (F2-T001)         | slot_capacidade_2            | T4 GREEN (estrutural) |
// | Desistência (RN-2.04/CA-2.04)  | tentativa_desistencia        | T5 GREEN              |
// | Encaminhamento (RN-2.05)       | tentativa_handoff            | T6 GREEN              |
// | Conflito simultâneo            | — (prova real em F2-IMP-004) | —                     |

export const FIXTURES = {
  // Slots sintéticos — grade mínima de prova, não a grade real (F2-IMP-002 materializa).
  slots: [
    {
      slot_id: 'slot-teste-cap1-0830',
      slot_datetime: '2026-09-21 08:30:00.000Z',
      slot_duration_min: 30,
      capacity: 1,
      status: 'ABERTO',
      created_by: 'fixture',
    },
    {
      slot_id: 'slot-teste-cap2-1200',
      slot_datetime: '2026-09-21 12:00:00.000Z',
      slot_duration_min: 30,
      capacity: 2,
      status: 'ABERTO', // janela 11:30–16:30 permite 2 simultâneos (F2-T001)
      created_by: 'fixture',
    },
    {
      slot_id: 'slot-teste-bloqueado-1700',
      slot_datetime: '2026-09-21 17:00:00.000Z',
      slot_duration_min: 30,
      capacity: 1,
      status: 'BLOQUEADO',
      created_by: 'fixture',
    },
  ],
  // Tentativas — uma por caminho da SPEC.
  appointments: [
    {
      fixture: 'lead_valido_slot_disponivel',
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
    },
    {
      fixture: 'lead_campos_ausentes',
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
    },
    {
      fixture: 'tentativa_desistencia',
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
    },
    {
      fixture: 'tentativa_handoff',
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
      status: 'ENCAMINHAMENTO_HUMANO',
      conflict_detected: false,
      handoff_reason: 'sem slots disponíveis (sintético)',
      created_at: '2026-09-21 08:20:00.000Z',
    },
  ],
  // Eventos sintéticos correspondentes.
  events: [
    {
      event_id: 'evt-teste-0001',
      appointment_id: 'appt-teste-0001',
      lead_submission_id: 'sub-teste-0001',
      event_type: 'APPOINTMENT_CREATED',
      occurred_at: '2026-09-21 08:05:00.000Z',
      actor_id: 'public',
      payload: { fixture: 'lead_valido_slot_disponivel' },
    },
    {
      event_id: 'evt-teste-0002',
      appointment_id: 'appt-teste-0002',
      lead_submission_id: 'sub-teste-0002',
      event_type: 'APPOINTMENT_CREATED',
      occurred_at: '2026-09-21 08:10:00.000Z',
      actor_id: 'public',
      payload: { fixture: 'lead_campos_ausentes' },
    },
    {
      event_id: 'evt-teste-0003',
      appointment_id: 'appt-teste-0003',
      lead_submission_id: 'sub-teste-0003',
      event_type: 'APPOINTMENT_ABANDONED',
      occurred_at: '2026-09-21 08:16:00.000Z',
      actor_id: 'public',
      payload: { fixture: 'tentativa_desistencia' },
    },
    {
      event_id: 'evt-teste-0004',
      appointment_id: 'appt-teste-0004',
      lead_submission_id: 'sub-teste-0004',
      event_type: 'APPOINTMENT_HANDOFF',
      occurred_at: '2026-09-21 08:20:00.000Z',
      actor_id: 'public',
      payload: { fixture: 'tentativa_handoff' },
    },
  ],
}
