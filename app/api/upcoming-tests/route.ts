import { NextResponse } from "next/server"
import { getUpcomingTests } from "@/lib/google-sheets-server"

export async function GET() {
  try {
    const testsData = await getUpcomingTests()

    return NextResponse.json({ success: true, data: testsData })
  } catch (error) {
    console.error("Ошибка при получении данных о тестах:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
