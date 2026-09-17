// F2-IMP-007 — Usuário sintético SEM permissão de assunção para a prova negativa do
// CA-2.09. O campo role é um select (valores fixos da criação do auth): 'marketing' é
// recusado, então a migração EXPANDE o select com o valor 'gestao' — papel da matriz
// F2-T004 (Subgerente/Gestão) que NÃO tem permissão de assunção nesta task (a
// reatribuição/escalada é a F2-IMP-008) e serve para provar o bloqueio por papel.
// Usuário removido após o ciclo de provas/teste humano; o valor 'gestao' permanece
// no select para a F2-IMP-008.

migrate(
  (app) => {
    // 1. expandir o select role com 'gestao' (se ainda não existir)
    const users = app.findCollectionByNameOrId('users')
    const roleField = users.fields.getByName('role')
    const values = roleField.values || []
    if (values.indexOf('gestao') < 0) {
      roleField.values = values.concat(['gestao'])
    }
    app.save(users)

    // 2. usuário sintético com papel gestao
    const user = new Record(users)
    user.set('email', 'marketing.teste@fellice-fitness.local')
    user.set('role', 'gestao')
    user.setPassword('GestaoTeste@2026')
    user.set('verified', true)
    app.save(user)
  },
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('users', 'email', 'marketing.teste@fellice-fitness.local'),
      )
    } catch (_) {}
  },
)
