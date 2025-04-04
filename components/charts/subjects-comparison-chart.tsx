"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { quarters, subjects, calculateAverage } from "@/lib/data"

type SubjectsComparisonChartProps = {
  gradesData: any
}

export function SubjectsComparisonChart({ gradesData }: SubjectsComparisonChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("current")

  // Подготовка данных для графика
  const prepareChartData = () => {
    if (!gradesData || !gradesData.subjects) return []

    return subjects
      .map((subject) => {
        const subjectData = gradesData.subjects[subject.id]
        if (!subjectData) return null

        const grades = selectedPeriod === "current" ? subjectData.current : subjectData.quarters[selectedPeriod] || []

        // Вычисляем средний балл только если есть оценки
        if (grades.length === 0) return null

        const average = calculateAverage(grades)

        return {
          name: subject.name,
          average: average || 0,
        }
      })
      .filter(Boolean) // Убираем null значения
      .sort((a, b) => b.average - a.average) // Сортируем по убыванию среднего балла
  }

  const chartData = prepareChartData()

  // Функция для определения цвета бара в зависимости от среднего балла
  const getBarColor = (average: number) => {
    if (average >= 9) return "#10b981" // зеленый
    if (average >= 7) return "#3b82f6" // синий
    if (average >= 5) return "#8b5cf6" // фиолетовый
    if (average >= 3) return "#f59e0b" // оранжевый
    return "#f43f5e" // красный
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Сравнение успеваемости по предметам</CardTitle>
        <CardDescription>Средний балл по каждому предмету</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Label htmlFor="period-select-bar">Период</Label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger id="period-select-bar">
              <SelectValue placeholder="Выберите период" />
            </SelectTrigger>
            <SelectContent>
              {quarters.map((quarter) => (
                <SelectItem key={quarter.id} value={quarter.id}>
                  {quarter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-[400px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 10]} />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip
                  formatter={(value) => [`${value}`, "Средний балл"]}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="average"
                  name="Средний балл"
                  radius={[0, 4, 4, 0]}
                  // Используем разные цвета для разных баров в зависимости от значения
                  fill="#8884d8"
                  // @ts-ignore - игнорируем ошибку типа для custom fill
                  fill={(entry: any) => getBarColor(entry.average)}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Нет данных для отображения
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
