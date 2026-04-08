import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-chat flex items-center justify-center p-4">
          <div className="bg-sidebar rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Что-то пошло не так</h2>
              <p className="text-sm text-muted">Произошла ошибка в приложении</p>
            </div>
            {this.state.error && (
              <div className="bg-chat rounded-xl p-3 mb-4">
                <p className="text-xs text-red-400 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
