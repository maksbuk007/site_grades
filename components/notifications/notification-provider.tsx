"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { Toaster } from "sonner"
import { toast } from "sonner"
import { Bell } from "lucide-react"

type Notification = {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  date: Date
  read: boolean
}

type NotificationContextType = {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, "id" | "date" | "read">) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotifications: () => void
  loadNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [lastCheck, setLastCheck] = useState<number>(0)

  // Загружаем уведомления из localStorage при инициализации
  useEffect(() => {
    const savedNotifications = localStorage.getItem("notifications")
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications)
        // Преобразуем строки дат обратно в объекты Date
        const withDates = parsed.map((n: any) => ({
          ...n,
          date: new Date(n.date),
        }))
        setNotifications(withDates)
      } catch (e) {
        console.error("Ошибка при загрузке уведомлений:", e)
      }
    }

    // Загружаем уведомления с сервера
    loadNotifications()
  }, [])

  // Сохраняем уведомления в localStorage при изменении
  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications))
  }, [notifications])

  // Количество непрочитанных уведомлений
  const unreadCount = notifications.filter((n) => !n.read).length

  // Загрузка уведомлений с сервера
  const loadNotifications = async () => {
    try {
      const response = await fetch("/api/notifications")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data) {
        // Получаем ID уже существующих уведомлений
        const existingIds = new Set(notifications.map((n) => n.id))

        // Преобразуем серверные уведомления в формат клиента
        const serverNotifications = data.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type as "info" | "success" | "warning" | "error",
          date: new Date(n.date),
          read: existingIds.has(n.id) ? notifications.find((en) => en.id === n.id)?.read || false : false,
        }))

        // Объединяем с существующими уведомлениями, избегая дубликатов
        const newNotifications = [...notifications]

        serverNotifications.forEach((serverNotification) => {
          if (!existingIds.has(serverNotification.id)) {
            newNotifications.push(serverNotification)

            // Показываем toast для новых уведомлений
            toast[serverNotification.type || "info"](serverNotification.title, {
              description: serverNotification.message,
              icon: <Bell className="h-4 w-4" />,
            })
          }
        })

        // Сортируем по дате (новые вверху)
        newNotifications.sort((a, b) => b.date.getTime() - a.date.getTime())

        setNotifications(newNotifications)
        setLastCheck(Date.now())
      }
    } catch (error) {
      console.error("Ошибка при загрузке уведомлений:", error)
    }
  }

  // Добавление нового уведомления
  const addNotification = (notification: Omit<Notification, "id" | "date" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      date: new Date(),
      read: false,
    }

    setNotifications((prev) => [newNotification, ...prev])

    // Показываем toast
    toast[notification.type || "info"](notification.title, {
      description: notification.message,
      icon: <Bell className="h-4 w-4" />,
    })
  }

  // Отметить уведомление как прочитанное
  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  // Отметить все уведомления как прочитанные
  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  // Очистить все уведомления
  const clearNotifications = () => {
    setNotifications([])
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        loadNotifications,
      }}
    >
      {children}
      <Toaster position="top-right" />
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
