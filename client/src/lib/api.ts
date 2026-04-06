import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Автоматический разлогин при 401 (протухший/невалидный токен)
// Исключаем auth-роуты чтобы не было цикла при неверном пароле
let isLoggingOut = false
api.interceptors.response.use(
  (response) => {
    isLoggingOut = false // сбрасываем флаг при успешном ответе
    return response
  },
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/') && !error.config?.url?.includes('/auth/')) {
      if (!isLoggingOut) {
        isLoggingOut = true
        useAuthStore.getState().logout()
      }
    }
    return Promise.reject(error)
  }
)

export default api
