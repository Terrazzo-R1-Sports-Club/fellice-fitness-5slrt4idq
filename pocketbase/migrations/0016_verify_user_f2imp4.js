// F2-IMP-004 — usuário sintético temporário para verificar as provas de leitura
// do roteiro RED/GREEN/regressão (tentativas não são legíveis sem login, por design).
// Padrão estabelecido: criar → provar → REMOVER (0017).

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    try {
      app.findFirstRecordByData('users', 'email', 'verifica.teste@fellice-fitness.local')
    } catch (_) {
      const user = new Record(users)
      user.set('email', 'verifica.teste@fellice-fitness.local')
      user.setPassword('VerificaTeste@2026')
      user.set('role', 'consultor')
      user.set('name', 'Verificação de Teste')
      user.set('verified', true)
      app.save(user)
    }
  },
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('users', 'email', 'verifica.teste@fellice-fitness.local'),
      )
    } catch (_) {}
  },
)
