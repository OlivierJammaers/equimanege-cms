import type { Metadata } from "next";
import Image from "next/image";
import logo from "@/assets/logo.webp";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Inloggen — EquiManage CRM",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/40 p-8">
      <div className="flex flex-col items-center gap-4">
        <Image
          src={logo}
          alt="EquiManage"
          width={72}
          height={66}
          priority
          className="rounded-2xl shadow-sm"
        />
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            EquiManage <span className="text-muted-foreground">CRM</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meld je aan met je CRM-account.
          </p>
        </div>
      </div>
      <LoginForm />
      <p className="text-xs text-muted-foreground">
        Alleen voor medewerkers van EquiManage.
      </p>
    </main>
  );
}
