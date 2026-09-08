migrate(
  (app) => {
    const submissions = app.findCollectionByNameOrId('lead_submissions')
    submissions.fields.add(new BoolField({ name: 'consentimento' }))
    submissions.fields.add(new DateField({ name: 'consentimento_at' }))
    app.save(submissions)
  },
  (app) => {
    const submissions = app.findCollectionByNameOrId('lead_submissions')
    submissions.fields.removeByName('consentimento_at')
    submissions.fields.removeByName('consentimento')
    app.save(submissions)
  },
)
