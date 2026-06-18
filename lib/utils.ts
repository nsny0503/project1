export function formatDeposit(value: string): string {
  const cleaned = value.replace(/,/g, '')
  const num = parseInt(cleaned, 10)
  if (isNaN(num)) return value
  if (num >= 10000) {
    const man = num / 10000
    const formatted = man.toLocaleString('ko-KR')
    return `${formatted}만원`
  }
  return `${num.toLocaleString('ko-KR')}원`
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value
}

export function contractTypeLabel(type: string): string {
  switch (type) {
    case 'A': return '월세'
    case 'B': return '전세'
    case 'C': return '단기'
    default: return type
  }
}

export function riskBadgeClass(risk: string): string {
  switch (risk) {
    case 'danger':
      return 'bg-red-100 text-red-700 border border-red-200'
    case 'warn':
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    case 'safe':
      return 'bg-green-100 text-green-700 border border-green-200'
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200'
  }
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
