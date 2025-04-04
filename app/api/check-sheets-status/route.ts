import { NextResponse } from "next/server"
import { checkSheetsConnection } from "@/lib/google-sheets-server"

export async function GET() {
  try {
    const result = await checkSheetsConnection()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Ошибка при проверке статуса Google Sheets:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Не удалось проверить статус подключения к Google Sheets",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
