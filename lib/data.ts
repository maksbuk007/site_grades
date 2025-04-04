// Типы данных
export type Subject = {
    id: string
    name: string
  }
  
  export type Grade = {
    value: number // Оценка от 1 до 10
    date: string // ISO формат даты
  }
  
  export type StudentGrades = {
    studentId: string
    subjects: {
      [subjectId: string]: {
        current: Grade[] // Текущие оценки
        quarters: {
          [quarter: string]: Grade[] // Оценки за четверть
        }
      }
    }
  }
  
  // Обновим тип StudentGrades, чтобы включить lastUpdate
  export type StudentGradesResponse = {
    data: StudentGrades
    lastUpdate?: string
  }
  
  export type UpcomingTest = {
    subjectId: string
    subjectName: string
    date: string
    description: string
  }
  
  // Список предметов
  export const subjects: Subject[] = [
    { id: "bel_lang", name: "Бел. яз." },
    { id: "bel_lit", name: "Бел. лит." },
    { id: "rus_lang", name: "Русск. яз." },
    { id: "rus_lit", name: "Русск. лит." },
    { id: "foreign_lang", name: "Ин. яз." },
    { id: "math", name: "Математика" },
    { id: "informatics", name: "Информатика" },
    { id: "world_history", name: "Всем. истор." },
    { id: "bel_history", name: "Истор. Бел." },
    { id: "social_studies", name: "Обществов." },
    { id: "geography", name: "География" },
    { id: "biology", name: "Биология" },
    { id: "physics", name: "Физика" },
    { id: "astronomy", name: "Астрономия" },
    { id: "chemistry", name: "Химия" },
    { id: "physical_edu", name: "Физ-ра" },
    { id: "dp_mp", name: "ДП/МП" },
  ]
  
  // Список учебных периодов (текущая 4-я четверть, прошлые - 1, 2 и 3)
  export const quarters = [
    { id: "2025-Q1", name: "1 четверть 2024-2025" },
    { id: "2025-Q2", name: "2 четверть 2024-2025" },
    { id: "2025-Q3", name: "3 четверть 2024-2025" },
    { id: "current", name: "4 четверть (текущая)" },
  ]
  
  // Обновим хранилище данных для кэширования
  const studentsDataCache: { [studentId: string]: StudentGradesResponse } = {}
  let upcomingTestsCache: UpcomingTest[] | null = null
  let lastCacheUpdate = 0
  
  // Обновим функцию getStudentData
  export async function getStudentData(studentId: string): Promise<StudentGradesResponse> {
    // Проверяем кэш (используем кэш, если он не старше 5 минут)
    const now = Date.now()
    if (studentsDataCache[studentId] && now - lastCacheUpdate < 5 * 60 * 1000) {
      return studentsDataCache[studentId]
    }
  
    try {
      // Получаем данные через API
      const response = await fetch(`/api/student-grades?studentId=${studentId}`)
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
  
      const result = await response.json()
  
      if (result.success && result.data) {
        // Обновляем кэш
        studentsDataCache[studentId] = {
          data: result.data,
          lastUpdate: result.lastUpdate,
        }
        lastCacheUpdate = now
        return studentsDataCache[studentId]
      }
  
      // If we don't have data, create an empty structure
      return {
        data: createEmptyStudentData(studentId),
        lastUpdate: "",
      }
    } catch (error) {
      console.error("Ошибка при получении данных ученика:", error)
      // If there's an error, return an empty structure
      return {
        data: createEmptyStudentData(studentId),
        lastUpdate: "",
      }
    }
  }
  
  // Helper function to create empty student data structure
  function createEmptyStudentData(studentId: string): StudentGrades {
    const emptyData: StudentGrades = {
      studentId,
      subjects: {},
    }
  
    subjects.forEach((subject) => {
      emptyData.subjects[subject.id] = {
        current: [],
        quarters: {
          "2024-Q1": [],
          "2024-Q2": [],
          "2024-Q3": [],
        },
      }
    })
  
    return emptyData
  }
  
  // Обновление оценки
  export async function updateGrade(
    studentId: string,
    subjectId: string,
    gradeIndex: number,
    newValue: number,
    quarter?: string,
  ): Promise<boolean> {
    try {
      // Обновляем оценку через API
      const response = await fetch("/api/manage-grades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          studentId,
          subjectId,
          gradeIndex,
          value: newValue,
          quarter,
        }),
      })
  
      const result = await response.json()
  
      if (result.success) {
        // Инвалидируем кэш
        delete studentsDataCache[studentId]
        return true
      }
  
      // Если API не сработал, обновляем локальные данные
      if (studentsDataCache[studentId]) {
        const studentData = studentsDataCache[studentId]
  
        if (quarter) {
          // Обновляем оценку в указанной четверти
          if (studentData.subjects[subjectId]?.quarters[quarter]?.[gradeIndex]) {
            studentData.subjects[subjectId].quarters[quarter][gradeIndex].value = newValue
            return true
          }
        } else {
          // Обновляем текущую оценку
          if (studentData.subjects[subjectId]?.current?.[gradeIndex]) {
            studentData.subjects[subjectId].current[gradeIndex].value = newValue
            return true
          }
        }
      }
  
      return false
    } catch (error) {
      console.error("Ошибка при обновлении оценки:", error)
  
      // Обновляем локальные данные при ошибке API
      if (studentsDataCache[studentId]) {
        const studentData = studentsDataCache[studentId]
  
        if (quarter) {
          // Обновляем оценку в указанной четверти
          if (studentData.subjects[subjectId]?.quarters[quarter]?.[gradeIndex]) {
            studentData.subjects[subjectId].quarters[quarter][gradeIndex].value = newValue
            return true
          }
        } else {
          // Обновляем текущую оценку
          if (studentData.subjects[subjectId]?.current?.[gradeIndex]) {
            studentData.subjects[subjectId].current[gradeIndex].value = newValue
            return true
          }
        }
      }
  
      return false
    }
  }
  
  // Добавление новой оценки
  export async function addGrade(
    studentId: string,
    subjectId: string,
    value: number,
    date: string,
    quarter?: string,
  ): Promise<boolean> {
    try {
      // Добавляем оценку через API
      const response = await fetch("/api/manage-grades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "add",
          studentId,
          subjectId,
          value,
          date,
          quarter,
        }),
      })
  
      const result = await response.json()
  
      if (result.success) {
        // Инвалидируем кэш
        delete studentsDataCache[studentId]
        return true
      }
  
      // Если API не сработал, обновляем локальные данные
      if (!studentsDataCache[studentId]) {
        // Если нет кэша, создаем новую структуру данных
        studentsDataCache[studentId] = createEmptyStudentData(studentId)
      }
  
      const studentData = studentsDataCache[studentId]
  
      // Убедимся, что структура данных существует
      if (!studentData.subjects[subjectId]) {
        studentData.subjects[subjectId] = {
          current: [],
          quarters: {
            "2024-Q1": [],
            "2024-Q2": [],
            "2024-Q3": [],
          },
        }
      }
  
      const newGrade = { value, date }
  
      if (quarter) {
        // Добавляем оценку в указанную четверть
        if (!studentData.subjects[subjectId].quarters[quarter]) {
          studentData.subjects[subjectId].quarters[quarter] = []
        }
        studentData.subjects[subjectId].quarters[quarter].push(newGrade)
      } else {
        // Добавляем текущую оценку
        studentData.subjects[subjectId].current.push(newGrade)
      }
  
      return true
    } catch (error) {
      console.error("Ошибка при добавлении оценки:", error)
  
      // Добавляем оценку локально при ошибке API
      if (!studentsDataCache[studentId]) {
        // Если нет кэша, создаем новую структуру данных
        studentsDataCache[studentId] = createEmptyStudentData(studentId)
      }
  
      const studentData = studentsDataCache[studentId]
  
      // Убедимся, что структура данных существует
      if (!studentData.subjects[subjectId]) {
        studentData.subjects[subjectId] = {
          current: [],
          quarters: {
            "2024-Q1": [],
            "2024-Q2": [],
            "2024-Q3": [],
          },
        }
      }
  
      const newGrade = { value, date }
  
      if (quarter) {
        // Добавляем оценку в указанную четверть
        if (!studentData.subjects[subjectId].quarters[quarter]) {
          studentData.subjects[subjectId].quarters[quarter] = []
        }
        studentData.subjects[subjectId].quarters[quarter].push(newGrade)
      } else {
        // Добавляем текущую оценку
        studentData.subjects[subjectId].current.push(newGrade)
      }
  
      return true
    }
  }
  
  // Удаление оценки
  export async function deleteGrade(
    studentId: string,
    subjectId: string,
    gradeIndex: number,
    quarter?: string,
  ): Promise<boolean> {
    try {
      // Удаляем оценку через API
      const response = await fetch("/api/manage-grades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          studentId,
          subjectId,
          gradeIndex,
          quarter,
        }),
      })
  
      const result = await response.json()
  
      if (result.success) {
        // Инвалидируем кэш
        delete studentsDataCache[studentId]
        return true
      }
  
      // Если API не сработал, обновляем локальные данные
      if (studentsDataCache[studentId]) {
        const studentData = studentsDataCache[studentId]
  
        if (quarter) {
          // Удаляем оценку из указанной четверти
          if (
            studentData.subjects[subjectId]?.quarters[quarter] &&
            gradeIndex >= 0 &&
            gradeIndex < studentData.subjects[subjectId].quarters[quarter].length
          ) {
            studentData.subjects[subjectId].quarters[quarter].splice(gradeIndex, 1)
            return true
          }
        } else {
          // Удаляем текущую оценку
          if (
            studentData.subjects[subjectId]?.current &&
            gradeIndex >= 0 &&
            gradeIndex < studentData.subjects[subjectId].current.length
          ) {
            studentData.subjects[subjectId].current.splice(gradeIndex, 1)
            return true
          }
        }
      }
  
      return false
    } catch (error) {
      console.error("Ошибка при удалении оценки:", error)
  
      // Удаляем оценку локально при ошибке API
      if (studentsDataCache[studentId]) {
        const studentData = studentsDataCache[studentId]
  
        if (quarter) {
          // Удаляем оценку из указанной четверти
          if (
            studentData.subjects[subjectId]?.quarters[quarter] &&
            gradeIndex >= 0 &&
            gradeIndex < studentData.subjects[subjectId].quarters[quarter].length
          ) {
            studentData.subjects[subjectId].quarters[quarter].splice(gradeIndex, 1)
            return true
          }
        } else {
          // Удаляем текущую оценку
          if (
            studentData.subjects[subjectId]?.current &&
            gradeIndex >= 0 &&
            gradeIndex < studentData.subjects[subjectId].current.length
          ) {
            studentData.subjects[subjectId].current.splice(gradeIndex, 1)
            return true
          }
        }
      }
  
      return false
    }
  }
  
  // Получение предстоящих тестов и событий
  export async function getUpcomingTestsData(): Promise<UpcomingTest[]> {
    // Проверяем кэш (используем кэш, если он не старше 15 минут)
    const now = Date.now()
    if (upcomingTestsCache && now - lastCacheUpdate < 15 * 60 * 1000) {
      return upcomingTestsCache
    }
  
    try {
      // Получаем данные через API
      const response = await fetch("/api/upcoming-tests")
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
  
      const result = await response.json()
  
      if (result.success && result.data) {
        // Обновляем кэш
        upcomingTestsCache = result.data
        lastCacheUpdate = now
        return result.data
      }
  
      return []
    } catch (error) {
      console.error("Ошибка при получении данных о тестах:", error)
      return []
    }
  }
  
  // Расчет среднего балла
  export function calculateAverage(grades: Grade[], roundToInteger = false): number {
    if (grades.length === 0) return 0
  
    const sum = grades.reduce((total, grade) => total + grade.value, 0)
    const average = sum / grades.length
  
    if (roundToInteger) {
      // Округление по правилу: >= x.5 -> x+1, < x.5 -> x
      return Math.floor(average + 0.5)
    }
  
    return Number.parseFloat(average.toFixed(2))
  }
  