'use client'
import { BookOpen, BookCheck, BookX, TrendingUp } from 'lucide-react'
import { StatCard } from '@/components/ui/glass'

export default function DashboardCards({ stats }) {
  const cards = [
    {
      title: 'Total Collection',
      value: stats?.total || 0,
      icon: BookOpen,
      tone: 'brand',
      hint: 'Books in the catalogue'
    },
    {
      title: 'Available Books',
      value: stats?.available || 0,
      icon: BookCheck,
      tone: 'success',
      hint: 'Ready to issue'
    },
    {
      title: 'Allocated Books',
      value: stats?.allocated || 0,
      icon: BookX,
      tone: 'navy',
      hint: 'Currently out on loan'
    },
    {
      title: 'Allocation Rate',
      value: `${stats?.allocationRate || 0}%`,
      icon: TrendingUp,
      tone: 'info',
      hint: 'Share of collection issued'
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <StatCard
          key={index}
          icon={card.icon}
          label={card.title}
          value={card.value}
          hint={card.hint}
          tone={card.tone}
          index={index + 1}
        />
      ))}
    </div>
  )
}
