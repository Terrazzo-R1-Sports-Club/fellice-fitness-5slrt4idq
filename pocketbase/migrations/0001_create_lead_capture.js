migrate(
  (app) => {
    const forms = new Collection({
      name: 'lead_forms',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'form_id', type: 'text', required: true, max: 120 },
        { name: 'name', type: 'text', required: true, max: 160 },
        { name: 'slug', type: 'text', required: true, max: 160 },
        { name: 'active_version', type: 'text', required: true, max: 40 },
        { name: 'description', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(forms)

    const versions = new Collection({
      name: 'lead_form_versions',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'form_id', type: 'text', required: true, max: 120 },
        { name: 'form_version', type: 'text', required: true, max: 40 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['DRAFT', 'TESTE', 'ATIVA', 'DESATIVADA'],
          maxSelect: 1,
        },
        { name: 'field_contract', type: 'json', required: true },
        { name: 'published_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(versions)

    const submissions = new Collection({
      name: 'lead_submissions',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'lead_submission_id', type: 'text', required: true, max: 120 },
        { name: 'form_id', type: 'text', required: true, max: 120 },
        { name: 'form_version', type: 'text', required: true, max: 40 },
        { name: 'started_at', type: 'date', required: true },
        { name: 'submitted_at', type: 'date' },
        { name: 'nome', type: 'text', required: true, max: 160 },
        { name: 'canal_de_retorno', type: 'text', required: true, max: 160 },
        {
          name: 'objetivo',
          type: 'select',
          required: true,
          values: [
            'Emagrecimento',
            'Ganho de massa muscular',
            'Condicionamento físico e resistência',
            'Saúde, mobilidade e qualidade de vida',
            'Recuperação de lesões',
            'Melhorar a performance esportiva',
            'Ainda não defini meu objetivo',
          ],
          maxSelect: 1,
        },
        {
          name: 'proximidade',
          type: 'select',
          required: true,
          values: [
            'Moro no Itaigara ou em bairros vizinhos',
            'Trabalho na região do Itaigara',
            'Passo com frequência pela região',
            'Moro/trabalho em outra região, mas me desloco para treinar',
            'Ainda não conheço bem a região',
          ],
          maxSelect: 1,
        },
        {
          name: 'ocupacao',
          type: 'select',
          values: [
            'CLT',
            'Autônomo/Empresário',
            'Executivo/Gestor',
            'Estudante',
            'Aposentado',
            'Profissional da saúde, educação ou outra área com horário irregular',
            'Prefiro não informar',
          ],
          maxSelect: 1,
        },
        {
          name: 'interesse_em_visita',
          type: 'select',
          required: true,
          values: [
            'Sim, quero agendar uma visita presencial',
            'Sim, quero agendar uma aula experimental',
            'Quero receber mais informações antes de decidir',
            'Não tenho interesse no momento',
          ],
          maxSelect: 1,
        },
        { name: 'precisa_de_ajuda_humana', type: 'bool' },
        { name: 'utm_source', type: 'text', max: 160 },
        { name: 'utm_medium', type: 'text', max: 160 },
        { name: 'utm_campaign', type: 'text', max: 160 },
        {
          name: 'attribution_status',
          type: 'select',
          required: true,
          values: ['recebida', 'incompleta', 'ausente'],
          maxSelect: 1,
        },
        {
          name: 'triagem_status',
          type: 'select',
          required: true,
          values: ['EM_ANDAMENTO', 'TRIAGEM_CONCLUIDA', 'ABANDONADO', 'SALVAMENTO_FALHOU'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(submissions)

    const events = new Collection({
      name: 'lead_submission_events',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, max: 120 },
        { name: 'lead_submission_id', type: 'text', required: true, max: 120 },
        {
          name: 'event_type',
          type: 'select',
          required: true,
          values: ['FORM_STARTED', 'TRIAGEM_CONCLUIDA', 'ABANDONADO', 'SALVAMENTO_FALHOU'],
          maxSelect: 1,
        },
        { name: 'occurred_at', type: 'date', required: true },
        { name: 'payload', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(events)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('lead_submission_events'))
    app.delete(app.findCollectionByNameOrId('lead_submissions'))
    app.delete(app.findCollectionByNameOrId('lead_form_versions'))
    app.delete(app.findCollectionByNameOrId('lead_forms'))
  },
)
