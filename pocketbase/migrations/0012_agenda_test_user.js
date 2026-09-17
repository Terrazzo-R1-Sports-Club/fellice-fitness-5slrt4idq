// F2-IMP-002 — usuário sintético temporário para a prova do ciclo de vida da grade
// (criar → editar → bloquear → reabrir via API, como faria o responsável pela agenda).
// Mesmo padrão da F2-IMP-001: criar → provar → REMOVER. A senha provisória não fica
// registrada em nenhum arquivo do produto além desta migração de teste, e o usuário é
// excluído na 0013 ao final da validação.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    try {
      app.findFirstRecordByData('users', 'email', 'agenda.teste@fellice-fitness.local')
    } catch (_) {
      const user = new Record(users)
      user.set('email', 'agenda.teste@fellice-fitness.local')
      user.setPassword('AgendaTeste@2026')
      user.set('role', 'consultor')
      user.set('name', 'Responsável de Agenda (teste)')
      user.set('verified', true)
      app.save(user)
    }
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 'agenda.teste@fellice-fitness.local'))
    } catch (_) {}
  },
)
