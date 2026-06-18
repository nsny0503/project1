import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Insure! | 외국인 임대차 계약 플랫폼',
  description: '외국인과 집주인이 함께 쓰는 AI 계약 안전장치',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="font-pretendard">{children}</body>
    </html>
  )
}
