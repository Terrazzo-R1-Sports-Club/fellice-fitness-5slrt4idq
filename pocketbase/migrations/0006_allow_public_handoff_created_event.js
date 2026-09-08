migrate(
  (app) => {
    const events = app.findCollectionByNameOrId('lead_handoff_events')
    events.createRule = ''
    app.save(events)
  },
  (app) => {
    const events = app.findCollectionByNameOrId('lead_handoff_events')
    events.createRule = '@request.auth.id != ""'
    app.save(events)
  },
)
