import React from 'react'
import { useNavigate } from 'react-router-dom'

const PublicHeader = () => {
  const navigate = useNavigate()
  return (
    <header className="fixed top-0 inset-x-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/') }>
          <img
            src="https://onekamer-media-cdn.b-cdn.net/logo/IMG_0885%202.PNG"
            alt="OneKamer"
            className="h-10 w-10 rounded-md object-contain bg-white"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/auth')} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50">
            Connexion
          </button>
          <button onClick={() => navigate('/auth')} className="px-4 py-2 text-sm font-medium rounded-md bg-[#2BA84A] text-white hover:bg-[#24903f]">
            Inscription
          </button>
        </div>
      </div>
    </header>
  )
}

export default PublicHeader
