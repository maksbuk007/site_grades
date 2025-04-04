import { google } from "googleapis"
import { JWT } from "google-auth-library"
import type { Grade, StudentGrades, UpcomingTest } from "./data"
import { subjects } from "./data"
import { getUserById, getAllStudents, type User } from "./users"

// Константы для работы с Google Sheets
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
const CURRENT_GRADES_SHEET = "Grades"
const PREVIOUS_GRADES_SHEET = "Previous_Grades"
const TESTS_DATES_SHEET = "Tests_dates"

// Диапазоны данных
const CURRENT_GRADES_RANGE = "A2:T28"
const PREVIOUS_GRADES_RANGE = "A2:T28"
const TESTS_DATES_RANGE = "A2:C18"

// Добавляем новые константы для работы с уведомлениями
const NOTIFICATIONS_SHEET = "Notifications"
const NOTIFICATIONS_RANGE = "A2:D100"

// Добавим константу для ячейки с датой обновления
const LAST_UPDATE_CELL = "U2"

// Инициализация клиента Google API с сервисным аккаунтом
export const initGoogleAuth = async () => {
  try {
    // Проверяем наличие необходимых переменных окружения
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new Error("Отсутствует email сервисного аккаунта (GOOGLE_SERVICE_ACCOUNT_EMAIL)")
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      throw new Error("Отсутствует приватный ключ сервисного аккаунта (GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)")
    }

    // Получаем приватный ключ из переменной окружения
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

    // Правильно обрабатываем приватный ключ, заменяя экранированные переносы строк
    // на реальные переносы строк
    const formattedKey = privateKey.replace(/\\n/g, "\n")

    // Создаем JWT клиент с правильно отформатированным ключом
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: formattedKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    // Проверяем авторизацию
    await auth.authorize()

    return auth
  } catch (error) {
    console.error("Ошибка аутентификации Google API:", error)
    throw new Error(
      `Не удалось аутентифицироваться в Google API: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

// Функция для проверки доступности Google Sheets
export async function checkSheetsConnection(): Promise<{
  success: boolean
  message: string
  error?: string
  spreadsheetInfo?: {
    title: string
    sheets: string[]
  }
}> {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Получаем информацию о таблице
    const spreadsheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })

    const spreadsheetInfo = {
      title: spreadsheetResponse.data.properties?.title || "Неизвестная таблица",
      sheets: spreadsheetResponse.data.sheets?.map((sheet) => sheet.properties?.title || "Неизвестный лист") || [],
    }

    return {
      success: true,
      message: "Подключение к Google Sheets успешно установлено",
      spreadsheetInfo,
    }
  } catch (error) {
    console.error("Ошибка при проверке подключения к Google Sheets:", error)
    return {
      success: false,
      message: "Не удалось подключиться к Google Sheets",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Функция для сопоставления имен из таблицы с именами в системе
function findStudentByName(lastName: string, firstName: string): User | undefined {
  // Пробуем найти точное совпадение "Фамилия Имя"
  const fullName = `${lastName} ${firstName}`.trim()
  let student = getAllStudents().find((s) => s.name.toLowerCase() === fullName.toLowerCase())

  // Если не нашли, пробуем найти по отдельным фамилии и имени
  if (!student) {
    student = getAllStudents().find((s) => {
      const nameParts = s.name.split(" ")
      const studentLastName = nameParts[0].toLowerCase()
      const studentFirstName = nameParts.length > 1 ? nameParts[1].toLowerCase() : ""

      return (
        studentLastName === lastName.toLowerCase() && (studentFirstName === firstName.toLowerCase() || firstName === "")
      )
    })
  }

  // Если все еще не нашли, пробуем найти только по фамилии
  if (!student) {
    student = getAllStudents().find((s) => {
      const nameParts = s.name.split(" ")
      const studentLastName = nameParts[0].toLowerCase()

      return studentLastName === lastName.toLowerCase()
    })
  }

  // Логируем результат поиска для отладки
  console.log(`Поиск ученика: ${lastName} ${firstName}, найден: ${student ? student.name : "не найден"}`)

  return student
}

// Добавим функцию для получения даты последнего обновления
export async function getLastUpdateDate(): Promise<string> {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Получаем дату последнего обновления из текущих оценок
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CURRENT_GRADES_SHEET}!${LAST_UPDATE_CELL}`,
    })

    const value = response.data.values?.[0]?.[0] || ""
    return value
  } catch (error) {
    console.error("Ошибка при получении даты последнего обновления:", error)
    return ""
  }
}

// Обновим функцию getAllGradesFromSheets, чтобы она возвращала также дату обновления
export async function getAllGradesFromSheets(): Promise<{
  studentsMap: Map<string, StudentGrades>
  lastUpdate: string
}> {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })
    const studentsMap = new Map<string, StudentGrades>()

    // Получаем текущие оценки
    const currentGradesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CURRENT_GRADES_SHEET}!${CURRENT_GRADES_RANGE}`,
    })

    // Получаем оценки за прошлые четверти
    const previousGradesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PREVIOUS_GRADES_SHEET}!${PREVIOUS_GRADES_RANGE}`,
    })

    // Получаем дату последнего обновления
    const lastUpdateResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CURRENT_GRADES_SHEET}!${LAST_UPDATE_CELL}`,
    })

    const lastUpdate = lastUpdateResponse.data.values?.[0]?.[0] || ""
    const currentGradesValues = currentGradesResponse.data.values || []
    const previousGradesValues = previousGradesResponse.data.values || []

    console.log("Данные из текущих оценок:", JSON.stringify(currentGradesValues.slice(0, 2)))
    console.log("Данные из прошлых оценок:", JSON.stringify(previousGradesValues.slice(0, 2)))
    console.log("Дата последнего обновления:", lastUpdate)

    // Создаем пустые структуры данных для всех учеников
    getAllStudents().forEach((student) => {
      studentsMap.set(student.id, {
        studentId: student.id,
        subjects: {},
      })

      subjects.forEach((subject) => {
        if (!studentsMap.get(student.id)!.subjects[subject.id]) {
          studentsMap.get(student.id)!.subjects[subject.id] = {
            current: [],
            quarters: {
              "2025-Q1": [],
              "2025-Q2": [],
              "2025-Q3": [],
            },
          }
        }
      })
    })

    // Обрабатываем текущие оценки
    currentGradesValues.forEach((row, index) => {
      if (row.length < 2) return // Пропускаем неполные строки

      const lastName = row[0] || ""
      const firstName = row[1] || ""

      // Находим ученика по имени
      const student = findStudentByName(lastName, firstName)
      if (!student) {
        console.log(`Не найден ученик для строки: ${lastName} ${firstName}`)
        return // Пропускаем, если ученик не найден
      }

      const studentId = student.id

      // Получаем объект для хранения оценок ученика
      const studentGrades = studentsMap.get(studentId)!

      // Обрабатываем оценки по предметам (начиная с 4-го столбца - индекс 3)
      subjects.forEach((subject, subjectIndex) => {
        // Оценки начинаются с столбца D (индекс 3)
        const columnIndex = subjectIndex + 3

        // Проверяем, что индекс не выходит за пределы массива
        if (columnIndex >= row.length) return

        // Получаем строку с оценками и разбиваем по запятым
        const gradesStr = row[columnIndex] || ""
        if (gradesStr) {
          const gradesArray = gradesStr
            .split(",")
            .map((g) => g.trim())
            .filter((g) => g !== "")

          // Преобразуем в массив оценок с датами
          const currentDate = new Date()
          const grades: Grade[] = gradesArray
            .map((gradeStr, i) => {
              // Генерируем последовательные даты для оценок
              const date = new Date(currentDate)
              date.setDate(date.getDate() - (gradesArray.length - i - 1) * 3)

              const value = Number.parseInt(gradeStr, 10)
              if (isNaN(value) || value <= 0) return null

              return {
                value: value,
                date: date.toISOString(),
              }
            })
            .filter((grade): grade is Grade => grade !== null) // Фильтруем невалидные оценки

          studentGrades.subjects[subject.id].current = grades

          // Логируем для отладки
          if (grades.length > 0) {
            console.log(
              `Для ученика ${student.name} по предмету ${subject.name} найдено ${grades.length} текущих оценок`,
            )
          }
        }
      })
    })

    // Обрабатываем оценки за прошлые четверти
    previousGradesValues.forEach((row, index) => {
      if (row.length < 2) return // Пропускаем неполные строки

      const lastName = row[0] || ""
      const firstName = row[1] || ""

      // Находим ученика по имени
      const student = findStudentByName(lastName, firstName)
      if (!student) return // Пропускаем, если ученик не найден

      const studentId = student.id

      // Получаем объект для хранения оценок ученика
      const studentGrades = studentsMap.get(studentId)!

      // Обрабатываем оценки по предметам (начиная с 4-го столбца - индекс 3)
      subjects.forEach((subject, subjectIndex) => {
        // Оценки начинаются с столбца D (индекс 3)
        const columnIndex = subjectIndex + 3

        // Проверяем, что индекс не выходит за пределы массива
        if (columnIndex >= row.length) return

        // Получаем строку с оценками и разбиваем по запятым
        const gradesStr = row[columnIndex] || ""
        if (gradesStr) {
          const gradesArray = gradesStr
            .split(",")
            .map((g) => g.trim())
            .filter((g) => g !== "")

          // Теперь каждая оценка соответствует определенной четверти
          // Первая оценка - 1 четверть, вторая - 2 четверть, третья - 3 четверть, четвертая - 4 четверть
          const quarters = ["2025-Q1", "2025-Q2", "2025-Q3", "current"]

          gradesArray.forEach((gradeStr, qIndex) => {
            if (qIndex >= quarters.length) return // Пропускаем, если больше 4 оценок

            const quarter = quarters[qIndex]
            const value = Number.parseInt(gradeStr, 10)

            if (!isNaN(value) && value > 0) {
              // Создаем дату для четверти
              const quarterDates = {
                "2025-Q1": new Date(2024, 10, 15), // 15 ноября 2024
                "2025-Q2": new Date(2024, 12, 15), // 15 января 2025
                "2025-Q3": new Date(2025, 2, 15), // 15 марта 2025
                current: new Date(2025, 4, 15), // 15 мая 2025
              }

              const date = quarterDates[quarter as keyof typeof quarterDates]

              // Добавляем оценку в соответствующую четверть
              if (quarter === "current") {
                studentGrades.subjects[subject.id].current = [
                  {
                    value: value,
                    date: date.toISOString(),
                  },
                ]
              } else {
                studentGrades.subjects[subject.id].quarters[quarter] = [
                  {
                    value: value,
                    date: date.toISOString(),
                  },
                ]
              }

              console.log(
                `Для ученика ${student.name} по предмету ${subject.name} за четверть ${quarter} найдена оценка ${value}`,
              )
            }
          })
        }
      })
    })

    return { studentsMap, lastUpdate }
  } catch (error) {
    console.error("Ошибка при получении оценок из Google Sheets:", error)
    throw error
  }
}

// Обновим функцию getStudentGradesFromSheets, чтобы она возвращала также дату обновления
export async function getStudentGradesFromSheets(studentId: string): Promise<{
  data: StudentGrades
  lastUpdate: string
} | null> {
  try {
    const { studentsMap, lastUpdate } = await getAllGradesFromSheets()
    const studentGrades = studentsMap.get(studentId)

    if (!studentGrades) {
      // Создаем пустую структуру данных
      const emptyData: StudentGrades = {
        studentId,
        subjects: {},
      }

      subjects.forEach((subject) => {
        emptyData.subjects[subject.id] = {
          current: [],
          quarters: {
            "2025-Q1": [],
            "2025-Q2": [],
            "2025-Q3": [],
          },
        }
      })

      return { data: emptyData, lastUpdate }
    }

    return { data: studentGrades, lastUpdate }
  } catch (error) {
    console.error(`Ошибка при получении оценок ученика ${studentId} из Google Sheets:`, error)
    throw error
  }
}

// Обновление оценки в Google Sheets
export async function updateGradeInSheets(
  studentId: string,
  subjectId: string,
  gradeIndex: number,
  newValue: number,
  quarter?: string,
): Promise<boolean> {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Получаем данные ученика
    const student = getUserById(studentId)
    if (!student) return false

    // Разделяем имя на фамилию и имя
    const nameParts = student.name.split(" ")
    const lastName = nameParts[0]
    const firstName = nameParts.length > 1 ? nameParts[1] : ""

    // Определяем, какой лист обновлять
    const sheetName = quarter ? PREVIOUS_GRADES_SHEET : CURRENT_GRADES_SHEET

    // Получаем текущие данные листа
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${quarter ? PREVIOUS_GRADES_RANGE : CURRENT_GRADES_RANGE}`,
    })

    const values = response.data.values || []

    // Ищем строку с данными ученика
    let rowIndex = -1
    for (let i = 0; i < values.length; i++) {
      const row = values[i]
      if (row.length < 2) continue

      const rowLastName = row[0] || ""
      const rowFirstName = row[1] || ""

      // Проверяем совпадение фамилии и имени
      if (
        rowLastName.toLowerCase() === lastName.toLowerCase() &&
        (rowFirstName.toLowerCase() === firstName.toLowerCase() || firstName === "")
      ) {
        rowIndex = i
        break
      }
    }

    if (rowIndex === -1) return false

    // Находим индекс столбца для предмета
    const subjectIndex = subjects.findIndex((s) => s.id === subjectId)
    if (subjectIndex === -1) return false

    const columnIndex = subjectIndex + 3 // D - это индекс 3

    // Если это прошлые четверти, обрабатываем по-другому
    if (quarter) {
      // Получаем текущие оценки
      const gradesStr = values[rowIndex][columnIndex] || ""
      const grades = gradesStr ? gradesStr.split(",").map((g) => g.trim()) : []

      // Определяем индекс четверти
      const quarterIndex = quarter === "2024-Q1" ? 0 : quarter === "2024-Q2" ? 1 : 2

      // Убеждаемся, что у нас достаточно элементов
      while (grades.length <= quarterIndex) {
        grades.push("")
      }

      // Обновляем оценку для соответствующей четверти
      grades[quarterIndex] = newValue.toString()

      // Обновляем ячейку в таблице
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!${getColumnLetter(columnIndex + 1)}${rowIndex + 2}`, // +2 потому что индексация с 1 и заголовок
        valueInputOption: "RAW",
        requestBody: {
          values: [[grades.join(", ")]],
        },
      })

      return true
    } else {
      // Для текущих оценок - обычная обработка
      const gradesStr = values[rowIndex][columnIndex] || ""
      const grades = gradesStr ? gradesStr.split(",").map((g) => g.trim()) : []

      // Обновляем оценку, если индекс существует
      if (gradeIndex >= 0 && gradeIndex < grades.length) {
        grades[gradeIndex] = newValue.toString()

        // Обновляем ячейку в таблице
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!${getColumnLetter(columnIndex + 1)}${rowIndex + 2}`, // +2 потому что индексация с 1 и заголовок
          valueInputOption: "RAW",
          requestBody: {
            values: [[grades.join(", ")]],
          },
        })

        return true
      }
    }

    return false
  } catch (error) {
    console.error("Ошибка при обновлении оценки в Google Sheets:", error)
    throw error
  }
}

// Добавление новой оценки в Google Sheets
export async function addGradeToSheets(
  studentId: string,
  subjectId: string,
  value: number,
  date: string,
  quarter?: string,
): Promise<boolean> {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Получаем данные ученика
    const student = getUserById(studentId)
    if (!student) return false

    // Разделяем имя на фамилию и имя
    const nameParts = student.name.split(" ")
    const lastName = nameParts[0]
    const firstName = nameParts.length > 1 ? nameParts[1] : ""

    // Определяем, какой лист обновлять
    const sheetName = quarter ? PREVIOUS_GRADES_SHEET : CURRENT_GRADES_SHEET

    // Получаем текущие данные листа
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${quarter ? PREVIOUS_GRADES_RANGE : CURRENT_GRADES_RANGE}`,
    })

    const values = response.data.values || []

    // Ищем строку с данными ученика
    let rowIndex = -1
    for (let i = 0; i < values.length; i++) {
      const row = values[i]
      if (row.length < 2) continue

      const rowLastName = row[0] || ""
      const rowFirstName = row[1] || ""

      // Проверяем совпадение фамилии и имени
      if (
        rowLastName.toLowerCase() === lastName.toLowerCase() &&
        (rowFirstName.toLowerCase() === firstName.toLowerCase() || firstName === "")
      ) {
        rowIndex = i
        break
      }
    }

    if (rowIndex === -1) return false

    // Находим индекс столбца для предмета
    const subjectIndex = subjects.findIndex((s) => s.id === subjectId)
    if (subjectIndex === -1) return false

    const columnIndex = subjectIndex + 3 // D - это индекс 3

    // Если это прошлые четверти, обрабатываем по-другому
    if (quarter) {
      // Получаем текущие оценки
      const gradesStr = values[rowIndex][columnIndex] || ""
      const grades = gradesStr ? gradesStr.split(",").map((g) => g.trim()) : []

      // Определяем индекс четверти
      const quarterIndex = quarter === "2024-Q1" ? 0 : quarter === "2024-Q2" ? 1 : 2

      // Убеждаемся, что у нас достаточно элементов
      while (grades.length <= quarterIndex) {
        grades.push("")
      }

      // Обновляем оценку для соответствующей четверти
      grades[quarterIndex] = value.toString()

      // Обновляем ячейку в таблице
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!${getColumnLetter(columnIndex + 1)}${rowIndex + 2}`, // +2 потому что индексация с 1 и заголовок
        valueInputOption: "RAW",
        requestBody: {
          values: [[grades.join(", ")]],
        },
      })

      return true
    } else {
      // Для текущих оценок - обычная обработка
      const gradesStr = values[rowIndex][columnIndex] || ""
      const grades = gradesStr ? gradesStr.split(",").map((g) => g.trim()) : []

      // Добавляем новую оценку
      grades.push(value.toString())

      // Обновляем ячейку в таблице
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!${getColumnLetter(columnIndex + 1)}${rowIndex + 2}`, // +2 потому что индексация с 1 и заголовок
        valueInputOption: "RAW",
        requestBody: {
          values: [[grades.join(", ")]],
        },
      })

      return true
    }
  } catch (error) {
    console.error("Ошибка при добавлении оценки в Google Sheets:", error)
    throw error
  }
}

// Удаление оценки из Google Sheets
export async function deleteGradeFromSheets(
  studentId: string,
  subjectId: string,
  gradeIndex: number,
  quarter?: string,
): Promise<boolean> {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Получаем данные ученика
    const student = getUserById(studentId)
    if (!student) return false

    // Разделяем имя на фамилию и имя
    const nameParts = student.name.split(" ")
    const lastName = nameParts[0]
    const firstName = nameParts.length > 1 ? nameParts[1] : ""

    // Определяем, какой лист обновлять
    const sheetName = quarter ? PREVIOUS_GRADES_SHEET : CURRENT_GRADES_SHEET

    // Получаем текущие данные листа
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${quarter ? PREVIOUS_GRADES_RANGE : CURRENT_GRADES_RANGE}`,
    })

    const values = response.data.values || []

    // Ищем строку с данными ученика
    let rowIndex = -1
    for (let i = 0; i < values.length; i++) {
      const row = values[i]
      if (row.length < 2) continue

      const rowLastName = row[0] || ""
      const rowFirstName = row[1] || ""

      // Проверяем совпадение фамилии и имени
      if (
        rowLastName.toLowerCase() === lastName.toLowerCase() &&
        (rowFirstName.toLowerCase() === firstName.toLowerCase() || firstName === "")
      ) {
        rowIndex = i
        break
      }
    }

    if (rowIndex === -1) return false

    // Находим индекс столбца для предмета
    const subjectIndex = subjects.findIndex((s) => s.id === subjectId)
    if (subjectIndex === -1) return false

    const columnIndex = subjectIndex + 3 // D - это индекс 3

    // Если это прошлые четверти, обрабатываем по-другому
    if (quarter) {
      // Получаем текущие оценки
      const gradesStr = values[rowIndex][columnIndex] || ""
      const grades = gradesStr ? gradesStr.split(",").map((g) => g.trim()) : []

      // Определяем индекс четверти
      const quarterIndex = quarter === "2024-Q1" ? 0 : quarter === "2024-Q2" ? 1 : 2

      // Убеждаемся, что у нас достаточно элементов
      while (grades.length <= quarterIndex) {
        grades.push("")
      }

      // Удаляем оценку для соответствующей четверти (устанавливаем пустую строку)
      grades[quarterIndex] = ""

      // Обновляем ячейку в таблице
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!${getColumnLetter(columnIndex + 1)}${rowIndex + 2}`, // +2 потому что индексация с 1 и заголовок
        valueInputOption: "RAW",
        requestBody: {
          values: [[grades.join(", ")]],
        },
      })

      return true
    } else {
      // Для текущих оценок - обычная обработка
      const gradesStr = values[rowIndex][columnIndex] || ""
      const grades = gradesStr ? gradesStr.split(",").map((g) => g.trim()) : []

      // Удаляем оценку, если индекс существует
      if (gradeIndex >= 0 && gradeIndex < grades.length) {
        grades.splice(gradeIndex, 1)

        // Обновляем ячейку в таблице
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!${getColumnLetter(columnIndex + 1)}${rowIndex + 2}`, // +2 потому что индексация с 1 и заголовок
          valueInputOption: "RAW",
          requestBody: {
            values: [[grades.join(", ")]],
          },
        })

        return true
      }
    }

    return false
  } catch (error) {
    console.error("Ошибка при удалении оценки из Google Sheets:", error)
    throw error
  }
}

// Получение данных о предстоящих тестах и событиях
export async function getUpcomingTests(): Promise<UpcomingTest[]> {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Получаем данные о тестах
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TESTS_DATES_SHEET}!${TESTS_DATES_RANGE}`,
    })

    const values = response.data.values || []
    const tests: UpcomingTest[] = []

    values.forEach((row) => {
      if (row.length < 3) return // Пропускаем неполные строки

      const subjectName = row[0] || ""
      const dateStr = row[1] || ""
      const eventDescription = row[2] || ""

      if (subjectName && dateStr && eventDescription) {
        // Находим ID предмета по имени
        const subject = subjects.find((s) => s.name === subjectName)

        tests.push({
          subjectId: subject?.id || "unknown",
          subjectName,
          date: dateStr,
          description: eventDescription,
        })
      }
    })

    // Сортируем по дате
    return tests.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } catch (error) {
    console.error("Ошибка при получении данных о тестах из Google Sheets:", error)
    return []
  }
}

// Функция для получения уведомлений из Google Sheets
export async function getNotificationsFromSheets() {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Проверяем, существует ли лист с уведомлениями
    const spreadsheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })

    const sheetExists = spreadsheetResponse.data.sheets?.some(
      (sheet) => sheet.properties?.title === NOTIFICATIONS_SHEET,
    )

    // Если лист не существует, создаем его
    if (!sheetExists) {
      await createNotificationsSheet()
    }

    // Получаем данные уведомлений
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTIFICATIONS_SHEET}!${NOTIFICATIONS_RANGE}`,
    })

    const values = response.data.values || []
    const notifications = []

    for (const row of values) {
      if (row.length < 3) continue // Пропускаем неполные строки

      const id = row[0] || ""
      const title = row[1] || ""
      const message = row[2] || ""
      const type = row[3] || "info"
      const date = row[4] || new Date().toISOString()

      if (id && title && message) {
        notifications.push({
          id,
          title,
          message,
          type,
          date,
        })
      }
    }

    return notifications.reverse() // Возвращаем в обратном порядке, чтобы новые были вверху
  } catch (error) {
    console.error("Ошибка при получении уведомлений из Google Sheets:", error)
    throw error
  }
}

// Функция для добавления нового уведомления в Google Sheets
export async function addNotificationToSheets(title: string, message: string, type = "info") {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Проверяем, существует ли лист с уведомлениями
    const spreadsheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })

    const sheetExists = spreadsheetResponse.data.sheets?.some(
      (sheet) => sheet.properties?.title === NOTIFICATIONS_SHEET,
    )

    // Если лист не существует, создаем его
    if (!sheetExists) {
      await createNotificationsSheet()
    }

    // Генерируем уникальный ID для уведомления
    const id = Date.now().toString()
    const date = new Date().toISOString()

    // Добавляем новое уведомление в начало листа
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTIFICATIONS_SHEET}!A2`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[id, title, message, type, date]],
      },
    })

    // Обновляем дату последнего обновления
    await updateLastUpdateDate()

    return true
  } catch (error) {
    console.error("Ошибка при добавлении уведомления в Google Sheets:", error)
    return false
  }
}

// Функция для создания листа с уведомлениями
async function createNotificationsSheet() {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Добавляем новый лист
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: NOTIFICATIONS_SHEET,
              },
            },
          },
        ],
      },
    })

    // Добавляем заголовки
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTIFICATIONS_SHEET}!A1:E1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["ID", "Заголовок", "Сообщение", "Тип", "Дата"]],
      },
    })

    // Форматируем заголовки (жирный шрифт)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: getSheetIdByName(NOTIFICATIONS_SHEET),
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                  },
                  backgroundColor: {
                    red: 0.9,
                    green: 0.9,
                    blue: 0.9,
                  },
                },
              },
              fields: "userEnteredFormat(textFormat,backgroundColor)",
            },
          },
        ],
      },
    })

    return true
  } catch (error) {
    console.error("Ошибка при создании листа с уведомлениями:", error)
    return false
  }
}

// Вспомогательная функция для получения ID листа по его имени
function getSheetIdByName(sheetName: string) {
  // В реальном приложении здесь должен быть код для получения ID листа
  // Для упрощения возвращаем 3 (предполагаем, что это 4-й лист)
  return 3
}

// Обновляем дату последнего обновления в Google Sheets
async function updateLastUpdateDate() {
  try {
    const auth = await initGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    const now = new Date().toLocaleString()

    // Обновляем ячейку с датой последнего обновления
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CURRENT_GRADES_SHEET}!${LAST_UPDATE_CELL}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[now]],
      },
    })

    return true
  } catch (error) {
    console.error("Ошибка при обновлении даты последнего обновления:", error)
    return false
  }
}

// Вспомогательная функция для преобразования числового индекса столбца в буквенное обозначение
function getColumnLetter(column: number): string {
  let temp: number
  let letter = ""

  while (column > 0) {
    temp = (column - 1) % 26
    letter = String.fromCharCode(temp + 65) + letter
    column = (column - temp - 1) / 26
  }

  return letter
}

// Инициализация таблицы для нового ученика (для совместимости с предыдущим кодом)
export async function initStudentSheet(studentId: string): Promise<boolean> {
  try {
    // Проверяем подключение к Google Sheets
    await initGoogleAuth()
    return true
  } catch (error) {
    console.error("Ошибка при инициализации таблицы для ученика:", error)
    return false
  }
}
