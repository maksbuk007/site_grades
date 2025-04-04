"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { getAllStudents, type User } from "@/lib/users"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Eye } from "lucide-react"

export default function StudentsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (user) {
      if (user.role !== "admin") {
        // Редирект на главную, если не админ
        router.push("/dashboard")
        return
      }

      // Имитация загрузки данных
      setTimeout(() => {
        const allStudents = getAllStudents()
        setStudents(allStudents)
        setLoading(false)
      }, 1000)
    }
  }, [user, router])

  // Фильтрация студентов по поисковому запросу
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.username.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Обработчик перехода к оценкам ученика
  const handleViewStudent = (studentId: string) => {
    router.push(`/dashboard/admin?studentId=${studentId}`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Список учеников</h2>
        <p className="text-muted-foreground">Всего учеников: {students.length}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени или логину..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ученики 11 класса</CardTitle>
          <CardDescription>Просмотр и управление учениками</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Логин</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.id}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.username}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleViewStudent(student.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Оценки
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      {searchTerm ? "Ученики не найдены" : "В этом классе нет учеников"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
