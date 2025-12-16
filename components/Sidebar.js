"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import Image from "next/image";

import toast from "react-hot-toast";
import {
  BookOpen,
  LayoutDashboard,
  Library,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  BookMarked,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Books", href: "/dashboard/books", icon: Library },
    { name: "Reservations", href: "/dashboard/reservations", icon: BookMarked },
    { name: "Completed", href: "/dashboard/completed-reservations", icon: BookMarked },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  async function handleLogout() {
    try {
      const success = await signOut();
      if (success) {
        toast.success("Logged out successfully!");
        router.push("/");
      } else {
        toast.error("Failed to logout");
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  }

  return (
    <>
      {/* Mobile Menu Button - Only show when menu is closed */}
      {!isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-[#fe9800] rounded-lg shadow-lg border-2 border-[#002147]"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-white border-r-2 border-[#fe9800]
          transform transition-transform duration-300 ease-in-out
          ${
            isMobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="flex items-center justify-between px-2 py-2 border-b-2 border-[#fe9800]">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                <Image
                  src="/logo1.jpg"
                  alt="Logo"
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain"
                />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-[#002147] font-serif text-sm leading-tight">
                  Thal University
                </h2>
                <p className="text-[10px] text-[#fe9800]">Library System</p>
              </div>
            </div>

            {/* Close button - Only visible on mobile when menu is open */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 bg-[#fe9800] rounded-lg border-2 border-[#002147] flex-shrink-0"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <button
                  key={item.name}
                  onClick={() => {
                    router.push(item.href);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-all font-bold border-2
                    ${
                      isActive
                        ? "bg-[#fe9800] text-white border-[#002147] shadow-md"
                        : "text-[#002147] border-transparent hover:bg-gray-100 hover:border-[#002147]"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
        />
      )}
    </>
  );
}
