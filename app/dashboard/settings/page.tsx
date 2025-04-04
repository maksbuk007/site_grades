"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { SheetsConnectionTester } from "@/components/sheets-connection-tester"
import { SheetsStatusChecker } from "@/components/sheets-status-checker"
import { DebugConnection } from "@/components/debug-connection"

export default function SettingsPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== "admin") {
      // Редирект на главную, если не админ
      router.push("/dashboard")
    }
  }, [user, router])

  if (!user || user.role !== "admin") {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Настройки</h2>
        <p className="text-muted-foreground">Управление настройками и интеграциями системы</p>
      </div>

      <div className="grid gap-6">
        <SheetsStatusChecker />
        <SheetsConnectionTester />
        <DebugConnection />
      </div>
    </div>
  )
}
