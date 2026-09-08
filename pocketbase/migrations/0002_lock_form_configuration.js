migrate(
  (app) => {
    const forms = app.findCollectionByNameOrId('lead_forms')
    forms.listRule = null
    forms.viewRule = null
    app.save(forms)

    const versions = app.findCollectionByNameOrId('lead_form_versions')
    versions.listRule = null
    versions.viewRule = null
    app.save(versions)
  },
  (app) => {
    const forms = app.findCollectionByNameOrId('lead_forms')
    forms.listRule = ''
    forms.viewRule = ''
    app.save(forms)

    const versions = app.findCollectionByNameOrId('lead_form_versions')
    versions.listRule = ''
    versions.viewRule = ''
    app.save(versions)
  },
)
