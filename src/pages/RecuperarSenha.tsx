import { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'

// T01-PWD — Página "esqueci minha senha": pede o e-mail e dispara o
// requestPasswordReset nativo do PocketBase. E-mail inexistente NÃO revela
// a existência da conta: a mensagem de sucesso é sempre genérica.
const RecuperarSenha = () => {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setErro('')
    try {
      await pb.collection('users').requestPasswordReset(email)
      setEnviado(true)
    } catch {
      // Genérico de propósito: 400 do PocketBase (e-mail inválido/formato)
      // e 404 (conta inexistente) caem aqui com a MESMA mensagem.
      setEnviado(true)
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
          <h1 className="mt-2 text-3xl font-black tracking-tight">Recuperar senha</h1>

          {enviado ? (
            <>
              <p className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300">
                Se existir uma conta para este e-mail, você receberá um link para criar uma nova
                senha. Verifique sua caixa de entrada e a pasta de spam.
              </p>
              <Link
                to="/fila"
                className="mt-6 block min-h-12 rounded-xl bg-orange-600 px-4 py-3 text-center font-bold text-white hover:bg-orange-700"
              >
                Voltar ao login
              </Link>
            </>
          ) : (
            <form onSubmit={enviar} noValidate>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
              </p>
              <label className="mt-6 block text-sm font-semibold">
                E-mail
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

export default RecuperarSenha
