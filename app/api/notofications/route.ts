import { type NextRequest, NextResponse } from "next/server"
import { getNotificationsFromSheets, addNotificationToSheets } from "@/lib/google-sheets-server"

// GET: Получение всех уведомлений
export async function GET() {
  try {
    const notifications = await getNotificationsFromSheets()
    return NextResponse.json({ success: true, data: notifications })
  } catch (error) {
    console.error("Ошибка при получении уведомлений:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

// POST: Добавление нового уведомления
export async function POST(request: NextRequest) {
  try {
    const { title, message, type = "info" } = await request.json()

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Отсутствуют обязательные поля (title, message)" },
        { status: 400 },
      )
    }

    const success = await addNotificationToSheets(title, message, type)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: "Не удалось добавить уведомление" }, { status: 500 })
    }
  } catch (error) {
    console.error("Ошибка при добавлении уведомления:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
