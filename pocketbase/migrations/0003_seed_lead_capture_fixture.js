migrate(
  (app) => {
    const forms = app.findCollectionByNameOrId('lead_forms')
    try {
      app.findFirstRecordByData('lead_forms', 'form_id', 'fellice-captura-01')
    } catch (_) {
      const form = new Record(forms)
      form.set('form_id', 'fellice-captura-01')
      form.set('name', 'Captura e triagem Fellice Fitness')
      form.set('slug', 'captura-triagem-fellice')
      form.set('active_version', 'v1.0.0')
      form.set('description', 'Formulário inicial de contexto para pré-agendamento.')
      app.save(form)
    }

    const versions = app.findCollectionByNameOrId('lead_form_versions')
    try {
      app.findFirstRecordByData('lead_form_versions', 'form_version', 'v1.0.0')
    } catch (_) {
      const version = new Record(versions)
      version.set('form_id', 'fellice-captura-01')
      version.set('form_version', 'v1.0.0')
      version.set('status', 'TESTE')
      version.set('field_contract', {
        nome: { required: true },
        canal_de_retorno: { required: true },
        proximidade: { required: true },
        objetivo: { required: true },
        ocupacao: { required: false },
        interesse_em_visita: { required: true },
        precisa_de_ajuda_humana: { required: false },
      })
      app.save(version)
    }
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('lead_form_versions', 'form_version', 'v1.0.0'))
    } catch (_) {}
    try {
      app.delete(app.findFirstRecordByData('lead_forms', 'form_id', 'fellice-captura-01'))
    } catch (_) {}
  },
)
