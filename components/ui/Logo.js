import Image from 'next/image'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: { emblem: 34, top: 'text-[15px]', rest: 'text-[11.5px]' },
  md: { emblem: 44, top: 'text-lg', rest: 'text-[13px]' },
  lg: { emblem: 60, top: 'text-2xl', rest: 'text-base' },
}

// University emblem + wordmark, drawn as text so it stays crisp on glass.
export default function Logo({ className, size = 'md', subtitle = 'Library System' }) {
  const s = SIZES[size]
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Image src="/tub-emblem.png" alt="" width={s.emblem} height={s.emblem} priority />
      <div className="leading-[1.1]" aria-hidden="true">
        <div className={cn('font-extrabold tracking-wide text-brand-500', s.top)}>THAL UNIVERSITY</div>
        <div className={cn('font-medium tracking-wide text-heading', s.rest)}>{subtitle}</div>
      </div>
      <span className="sr-only">Thal University Bhakkar {subtitle}</span>
    </div>
  )
}
