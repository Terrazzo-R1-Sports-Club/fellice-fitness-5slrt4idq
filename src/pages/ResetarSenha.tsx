import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'

// T01-PWD — Página de nova senha: token vem da URL (link do e-mail do
// PocketBase: /resetar-senha?token=...), valida força e confirmação e chama
// o confirmPasswordReset nativo do PocketBase.
const SENHA_FORTE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

const ResetarSenha = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [concluido, setConcluido] = useState(false)

  const salvar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErro('')
    if (!token) {
      setErro('Link inválido ou incompleto. Solicite um novo link de recuperação.')
      return
    }
    if (!SENHA_FORTE.test(senha)) {
      setErro('A senha precisa ter ao menos 8 caracteres, com letra maiúscula, minúscula e número.')
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }
    setLoading(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, senha, confirmacao)
      setConcluido(true)
    } catch (err) {
      console.error(err)
      const status = (err as { status?: number })?.status
      if (status === 400) {
        setErro(
          'Link inválido ou expirado, ou a senha não atende às regras. Solicite um novo link de recuperação.',
        )
      } else {
        setErro('Não foi possível redefinir a senha agora. Tente novamente em instantes.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh bg-[#fffaf5] px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-md">
        <Link to="/fila" className="text-sm font-semibold text-orange-600 hover:underline">
          ← Voltar para a fila
        </Link>
        <div className="mt-6 rounded-3xl border border-orange-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-600">
            Fellice Fitness
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Criar nova senha</h1>

          {!token ? (
            <>
              <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                Link inválido ou incompleto. Solicite um novo link de recuperação.
              </p>
              <Link
                to="/recuperar-senha"
                className="mt-6 block min-h-12 rounded-xl bg-orange-600 px-4 py-3 text-center font-bold text-white hover:bg-orange-700"
              >
                Solicitar novo link
              </Link>
            </>
          ) : concluido ? (
            <>
              <p className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300">
                Senha redefinida com sucesso! Faça login com a nova senha.
              </p>
              <Link
                to="/fila"
                className="mt-6 block min-h-12 rounded-xl bg-orange-600 px-4 py-3 text-center font-bold text-white hover:bg-orange-700"
              >
                Ir para o login
              </Link>
            </>
          ) : (
            <form onSubmit={salvar} noValidate>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Crie uma nova senha com pelo menos 8 caracteres, incluindo letra maiúscula,
                minúscula e número.
              </p>
              <label className="mt-6 block text-sm font-semibold">
                Nova senha
                <input
                  required
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Confirmar nova senha
                <input
                  required
                  type="password"
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              {erro && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300"
                >
                  {erro}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-5 min-h-12 w-full rounded-xl bg-orange-600 px-4 font-bold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

export default ResetarSenha
