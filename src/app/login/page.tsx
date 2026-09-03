import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/50 p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold text-white">UCL Fantasy</h1>
        <p className="mb-6 text-sm text-slate-400">
          Private league — sign in to continue.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
