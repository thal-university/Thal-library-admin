import { twMerge } from 'tailwind-merge'

// Join class names, skipping falsy values; later classes win over conflicting earlier ones
export function cn(...classes) {
  return twMerge(classes.filter(Boolean).join(' '))
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
