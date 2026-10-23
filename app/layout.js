import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata = {
  title: 'Thal University Library',
  description: 'Library Management System',
  icons: { icon: '/tub-emblem.png' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full" suppressHydrationWarning>
        <div className="aurora" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        {children}
        {/* One app-wide toast container, styled to match the glass surfaces */}
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'glass-strong',
            style: {
              borderRadius: '14px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--ink)',
              background: 'rgba(255, 255, 255, 0.86)',
            },
            success: { iconTheme: { primary: '#15803d', secondary: '#fff' } },
            error: { iconTheme: { primary: '#c2410c', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
