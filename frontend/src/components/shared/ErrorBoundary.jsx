import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Sayfa çöktü:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
          <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-lg w-full shadow-sm">
            <div className="text-4xl mb-4">💥</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Sayfa yüklenirken bir hata oluştu</h2>
            <p className="text-sm text-gray-500 mb-4">Tarayıcı konsolunu (F12) açarak detayı görebilirsin.</p>
            <div className="bg-red-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-mono text-red-700 break-all">
                {this.state.error?.message || String(this.state.error)}
              </p>
            </div>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
