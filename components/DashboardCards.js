'use client'
import { BookOpen, BookCheck, BookX, TrendingUp } from 'lucide-react'

export default function DashboardCards({ stats }) {
  const cards = [
    {
      title: 'Total Collection',
      value: stats?.total || 0,
      icon: BookOpen
    },
    {
      title: 'Available Books',
      value: stats?.available || 0,
      icon: BookCheck
    },
    {
      title: 'Allocated Books',
      value: stats?.allocated || 0,
      icon: BookX
    },
    {
      title: 'Allocation Rate',
      value: `${stats?.allocationRate || 0}%`,
      icon: TrendingUp
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <div
            key={index}
            className="bg-white rounded-xl p-4 sm:p-5 border-2 border-[#fe9800] shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 sm:p-2.5 rounded-lg bg-[#fe9800] shadow-md">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#002147] font-serif">
                {card.value}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t-2 border-[#002147]/10">
              <h3 className="text-[#002147] text-xs font-bold uppercase tracking-wide">
                {card.title}
              </h3>
            </div>
          </div>
        )
      })}
    </div>
  )
}
