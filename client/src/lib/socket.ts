import { io } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

export const socket = io('/', {
  autoConnect: false,
  auth: (cb) => cb({ token: useAuthStore.getState().token }),
})
