"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BookOpen, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Loader from "@/components/Loader";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  // Check if user is already logged in
  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      // Check if user session exists in localStorage
      const userSession = localStorage.getItem("library_user");
      if (userSession) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error checking session:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Authenticate using username and password from users table
      const { data: users, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", formData.username)
        .eq("password", formData.password)
        .single();

      if (error) {
        console.error("Database error:", error);
        if (error.code === "PGRST116") {
          throw new Error("Invalid username or password");
        }
        throw new Error(
          "Database connection error. Please check if the users table exists."
        );
      }

      if (!users) {
        throw new Error("Invalid username or password");
      }

      // Store user session in localStorage
      localStorage.setItem(
        "library_user",
        JSON.stringify({
          id: users.id,
          username: users.username,
          name: users.name,
          email: users.email,
        })
      );

      toast.success(`Welcome back, ${users.name}!`);
      router.push("/dashboard");
    } catch (error) {
      console.error("Auth error:", error);
      toast.error(error.message || "Invalid username or password");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
      <Toaster position="top-right" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-7">
         

          <div className="inline-flex items-center justify-center w-20 h-20" >
            <Image
              src="/logo1.jpg"
              alt="Logo"
              width={40}
              height={40}
              className="w-20 h-20 object-contain rounded-2xl "
            />
          </div>
          <h1 className="text-3xl font-bold text-[#002147] dark:text-[#fe9800] mb-2 font-serif tracking-wide">
            Thal University
          </h1>
          <p className="text-gray-700 dark:text-gray-300 font-medium text-base">
            Library Management System
          </p>
          <div className="mt-3 inline-block px-4 py-1 bg-gray-100 dark:bg-gray-800 rounded-full border-2 border-[#002147] dark:border-[#fe9800]">
            <p className="text-xs text-[#002147] dark:text-[#fe9800] font-semibold">
              Knowledge is the foundation of excellence
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-[#002147] dark:border-[#fe9800] overflow-hidden">
          {/* Header */}
          <div className="bg-[#002147] dark:bg-[#fe9800] py-4 px-6">
            <h2 className="text-xl font-bold text-white text-center font-serif flex items-center justify-center gap-2">
              <Lock className="w-6 h-6" />
              Admin Login
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-7 space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                Username *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#fe9800]" />
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#fe9800]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full pl-11 pr-11 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#fe9800] hover:text-[#002147]"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-[#fe9800] border-gray-300 rounded focus:ring-[#fe9800]"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                  Remember me
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#fe9800] dark:bg-[#002147] text-white rounded-lg font-bold hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-2 border-[#002147] dark:border-[#fe9800]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Access Library System
                </>
              )}
            </button>

            <div className="text-center pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                Authorized personnel only
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-1.5">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            © 2025 Thal University. All rights reserved.
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Empowering minds through knowledge
          </p>
        </div>
      </div>
    </div>
  );
}
