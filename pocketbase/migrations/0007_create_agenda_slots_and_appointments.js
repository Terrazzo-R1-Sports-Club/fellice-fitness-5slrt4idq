// F2-IMP-001 / SPEC-2-001 — contrato técnico de agenda e tentativa de agendamento.
// Leva 2 da Fase 2. Nenhuma tela, nenhuma publicação, nenhum dado real.
//
// Semântica de idempotência (RN-2.05 / CA-2.02 — texto literal da SPEC):
//   "Reenvio do mesmo `lead_submission_id` para o mesmo slot atualiza `appointment_id`
//    existente; não cria segunda tentativa no mesmo slot."
//   Implementada como índice único composto (lead_submission_id, slot_id) em lead_appointments.
//   RN-2.06 (conflito): a tentativa NÃO confirmada permanece um único registro por submissão
//   e é ATUALIZADA com o novo slot escolhido (não cria segundo registro) — um lead nunca ocupa
//   duas vagas ao mesmo tempo. Decisão documentada no contrato da task; validável pelo Champion.
//
// Validação de campos mínimos por estado: regra de FLUXO (F2-IMP-003), não de banco.
//   CONCLUIDO exige nome, telefone_ou_canal_de_retorno, localidade, profissao + concluded_at.
//   ENCAMINHAMENTO_HUMANO exige handoff_reason. DESISTENCIA exige apenas o registro.
//   Por isso nome/telefone/localidade/profissao NÃO são required no banco: a TENTATIVA nasce
//   antes do preenchimento (RN-2.02). O teste de bloqueio de CONCLUIDO sem campos mínimos é
//   RED deliberado nesta fase (o fluxo que valida ainda não existe — ver contrato da task).
//
// Invariante do slot (declarada; prova de concorrência real é da F2-IMP-004):
//   status RESERVADO ⇔ reservas ativas >= capacity. Nada no banco muda status sozinho.
//
// Validação de referência (tentativa → submissão existente): fica para o fluxo nesta fase;
// PocketBase não cria chave estrangeira nativa em campo text. Evolução futura se a plataforma
// suportar hook persistente fora do ciclo de migração.

migrate(
  (app) => {
    // ---------- agenda_slots ----------
    // Leitura pública (o lead precisa ver a grade); escrita só autenticada
    // (responsável da agenda: Consultor Comercial / Subgerente / Champion — F2-T002).
    const slots = new Collection({
      name: 'agenda_slots',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      updateRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      deleteRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      fields: [
        { name: 'slot_id', type: 'text', required: true, max: 120 },
        { name: 'slot_datetime', type: 'date', required: true },
        { name: 'slot_duration_min', type: 'number', required: true, min: 1 },
        { name: 'capacity', type: 'number', required: true, min: 1 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ABERTO', 'RESERVADO', 'BLOQUEADO'],
          maxSelect: 1,
        },
        { name: 'created_by', type: 'text', max: 120 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_agenda_slots_slot_id` ON `agenda_slots` (`slot_id`)'],
    })
    app.save(slots)

    // ---------- lead_appointments ----------
    // Criação pública (o lead cria a tentativa na tela de agendamento, sem login);
    // leitura/atualização só autenticada (visão operacional — SPEC-2-002);
    // exclusão nunca (append de histórico).
    const appointments = new Collection({
      name: 'lead_appointments',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      viewRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      createRule: '',
      updateRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      deleteRule: null,
      fields: [
        { name: 'appointment_id', type: 'text', required: true, max: 120 },
        { name: 'lead_submission_id', type: 'text', required: true, max: 120 },
        { name: 'form_id', type: 'text', required: true, max: 120 },
        { name: 'form_version', type: 'text', required: true, max: 40 },
        // Slot opcional na tentativa: o encaminhamento humano (RN-2.05) pode nascer
        // SEM slot (ausência de slots disponíveis). Obrigatório só na conclusão (fluxo).
        { name: 'slot_id', type: 'text', max: 120 },
        { name: 'slot_datetime', type: 'date' },
        { name: 'slot_duration_min', type: 'number', min: 1 },
        { name: 'nome', type: 'text', max: 160 },
        { name: 'telefone_ou_canal_de_retorno', type: 'text', max: 160 },
        { name: 'localidade', type: 'text', max: 200 },
        { name: 'profissao', type: 'text', max: 160 },
        { name: 'email', type: 'text', max: 160 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['TENTATIVA', 'CONCLUIDO', 'DESISTENCIA', 'ENCAMINHAMENTO_HUMANO'],
          maxSelect: 1,
        },
        { name: 'conflict_detected', type: 'bool' },
        { name: 'handoff_reason', type: 'text', max: 500 },
        { name: 'created_at', type: 'date', required: true },
        { name: 'concluded_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_lead_appointments_appointment_id` ON `lead_appointments` (`appointment_id`)',
        'CREATE UNIQUE INDEX `idx_lead_appointments_submission_slot` ON `lead_appointments` (`lead_submission_id`, `slot_id`)',
      ],
    })
    app.save(appointments)

    // ---------- lead_appointment_events ----------
    // Append-only: criação pública (eventos nascem no fluxo do lead, precedente 0006),
    // leitura autenticada, atualização/exclusão nunca.
    const events = new Collection({
      name: 'lead_appointment_events',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      viewRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, max: 120 },
        { name: 'appointment_id', type: 'text', required: true, max: 120 },
        { name: 'lead_submission_id', type: 'text', required: true, max: 120 },
        {
          name: 'event_type',
          type: 'select',
          required: true,
          values: [
            'APPOINTMENT_CREATED',
            'APPOINTMENT_CONCLUDED',
            'APPOINTMENT_ABANDONED',
            'APPOINTMENT_HANDOFF',
            'APPOINTMENT_CONFLICT',
          ],
          maxSelect: 1,
        },
        { name: 'occurred_at', type: 'date', required: true },
        { name: 'actor_id', type: 'text', max: 120 },
        { name: 'payload', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_appointment_events_event` ON `lead_appointment_events` (`event_id`)',
      ],
    })
    app.save(events)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('lead_appointment_events'))
    app.delete(app.findCollectionByNameOrId('lead_appointments'))
    app.delete(app.findCollectionByNameOrId('agenda_slots'))
  },
)
