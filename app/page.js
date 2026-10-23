"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Eye, EyeOff, Library, Loader2, Lock, User, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import Loader from "@/components/Loader";
import Logo from "@/components/ui/Logo";
import { ui } from "@/components/ui/glass";

const HIGHLIGHTS = [
  { icon: Library, text: "Full book catalogue across every department" },
  { icon: BookOpenCheck, text: "Issue, return and reservation tracking" },
  { icon: Wallet, text: "Overdue fines recorded and collected" },
];

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
      // Authentication runs server-side: `public.users` has row level security
      // on, so the browser's anon key reads zero rows from it.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Invalid username or password");
      }

      // Kept for the header/sidebar display name. The signed httpOnly cookie
      // set by the route is what actually authorises anything.
      localStorage.setItem("library_user", JSON.stringify(payload.user));

      toast.success(`Welcome back, ${payload.user.name}!`);
      router.push("/dashboard");
    } catch (error) {
      console.error("Login failed:", error.message);
      toast.error(error.message || "Invalid username or password");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loader />;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="glass-strong rise grid w-full max-w-[400px] overflow-hidden rounded-3xl md:max-w-3xl md:grid-cols-[1fr_1fr]">
        {/* Brand side */}
        <section className="relative hidden flex-col justify-between gap-8 overflow-hidden p-7 md:flex">
          <div aria-hidden="true" className="absolute -top-20 -left-20 size-64 rounded-full bg-brand-200/50 blur-3xl" />
          <div aria-hidden="true" className="absolute -right-12 -bottom-20 size-72 rounded-full bg-sky-200/60 blur-3xl" />

          <Logo size="md" className="relative" />

          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
              Library Management System
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-heading">
              Every book, loan and
              <br />
              fine in one place.
            </h1>
            <ul className="mt-5 space-y-2.5">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-[13px] text-ink-soft">
                  <span className="glass grid size-8 shrink-0 place-items-center rounded-xl text-brand-600">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-[11px] text-ink-muted">Central Library &middot; Thal University Bhakkar</p>
        </section>

        {/* Form side */}
        <section className="flex flex-col justify-center bg-surface/45 p-6 sm:p-7 md:border-l md:border-edge/70">
          <Logo size="sm" className="mb-6 md:hidden" />

          <h2 className="text-xl font-bold text-heading">Welcome back</h2>
          <p className="mt-1 text-[13px] text-ink-muted">Sign in to the library admin panel.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            <div>
              <label htmlFor="username" className={ui.label}>
                Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input
                  id="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className={`${ui.input} h-10 pl-9`}
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className={ui.label}>
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`${ui.input} h-10 pl-9 pr-10`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:bg-surface/80 hover:text-ink"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className={`${ui.btnPrimary} h-10 w-full`}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <p className="pt-1 text-center text-[11.5px] text-ink-muted">Authorized library staff only</p>
          </form>
        </section>
      </div>
    </main>
  );
}
