import { type NextRequest, NextResponse } from "next/server"
import { initGoogleAuth } from "@/lib/google-sheets-server"

export async function GET(request: NextRequest) {
  try {
    // Проверяем наличие переменных окружения (без их раскрытия)
    const envStatus = {
      email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey:
        !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes("PRIVATE KEY"),
      spreadsheetId: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    }

    // Если какая-то переменная отсутствует, возвращаем ошибку
    if (!envStatus.email) {
      return NextResponse.json(
        {
          success: false,
          message: "Отсутствует email сервисного аккаунта",
          error: "Переменная окружения GOOGLE_SERVICE_ACCOUNT_EMAIL не найдена",
          envStatus,
        },
        { status: 400 },
      )
    }

    if (!envStatus.privateKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Отсутствует приватный ключ сервисного аккаунта",
          error: "Переменная окружения GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY не найдена или некорректна",
          envStatus,
        },
        { status: 400 },
      )
    }

    if (!envStatus.spreadsheetId) {
      return NextResponse.json(
        {
          success: false,
          message: "Отсутствует ID таблицы Google Sheets",
          error: "Переменная окружения GOOGLE_SHEETS_SPREADSHEET_ID не найдена",
          envStatus,
        },
        { status: 400 },
      )
    }

    // Пытаемся инициализировать подключение к Google API
    const auth = await initGoogleAuth()

    // Если успешно, возвращаем информацию (без раскрытия полных значений)
    return NextResponse.json({
      success: true,
      message: "Подключение к Google Sheets API успешно установлено",
      serviceAccount: maskEmail(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ""),
      spreadsheetId: maskId(process.env.GOOGLE_SHEETS_SPREADSHEET_ID || ""),
      envStatus,
    })
  } catch (error) {
    console.error("Ошибка при подключении к Google Sheets API:", error)

    return NextResponse.json(
      {
        success: false,
        message: "Не удалось подключиться к Google Sheets API",
        error: error instanceof Error ? error.message : String(error),
        envStatus: {
          email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          privateKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
          spreadsheetId: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        },
      },
      { status: 500 },
    )
  }
}

// Функция для маскирования email (показывает только первые 3 символа и домен)
function maskEmail(email: string): string {
  if (!email) return ""
  const parts = email.split("@")
  if (parts.length !== 2) return "***@***.***"

  const username = parts[0]
  const domain = parts[1]

  const maskedUsername = username.substring(0, 3) + "***"
  return `${maskedUsername}@${domain}`
}

// Функция для маскирования ID (показывает только первые и последние 4 символа)
function maskId(id: string): string {
  if (!id) return ""
  if (id.length <= 8) return "********"

  return id.substring(0, 4) + "****" + id.substring(id.length - 4)
}
