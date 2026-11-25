// REF-03 / SPEC-4-004 — novas opções de rotina e pergunta de profissão.
// Atualiza o select ocupacao de lead_submissions para a lista aprovada pela
// cliente em 29/10/2026 e adiciona o campo profissao (resposta da pergunta
// secundária de CLT/Autônomo). Registros antigos não são recalculados (regra 5
// da SPEC): o texto histórico permanece legível mesmo fora da nova lista.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('lead_submissions')
    const ocupacao = col.fields.getByName('ocupacao')
    ocupacao.values = [
      'CLT',
      'Autônomo',
      'Empresário',
      'Diretor ou alta gerência',
      'Estudante',
      'Aposentado',
      'Prefiro não informar',
    ]
    if (!col.fields.getByName('profissao')) {
      col.fields.add(new TextField({ name: 'profissao', max: 160 }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('lead_submissions')
    const ocupacao = col.fields.getByName('ocupacao')
    ocupacao.values = [
      'CLT',
      'Autônomo/Empresário',
      'Executivo/Gestor',
      'Estudante',
      'Aposentado',
      'Profissional da saúde, educação ou outra área com horário irregular',
      'Prefiro não informar',
    ]
    if (col.fields.getByName('profissao')) {
      col.fields.removeByName('profissao')
    }
    app.save(col)
  },
)
