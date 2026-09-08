/* 404 Page - Displays when a user attempts to access a non-existent route - translate to the language of the user */
import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground transition-colors duration-200">
      <div className="text-center p-8 rounded-3xl border border-border bg-card shadow-lg">
        <h1 className="text-4xl font-black mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-6">Página não encontrada</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}

export default NotFound
