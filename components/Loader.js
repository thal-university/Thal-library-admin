'use client'
import { useEffect, useState } from 'react'

export default function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-[#fe9800] rounded-full animate-spin" style={{ animationDuration: '0.8s' }}></div>
          <div className="absolute inset-2 border-4 border-transparent border-t-[#002147] rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
        </div>
        <h2 className="text-2xl font-bold text-[#002147] dark:text-[#fe9800] mb-2 font-serif">
          Thal University
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Loading Library System...</p>
      </div>
    </div>
  )
}