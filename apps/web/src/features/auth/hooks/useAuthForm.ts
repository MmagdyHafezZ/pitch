import { useForm } from '@mantine/form'
import { useAuth } from './useAuth'
import { LoginCredentials, RegisterCredentials } from '../types/auth.types'

interface UseLoginFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

interface UseRegisterFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export const useLoginForm = ({ onSuccess, onError }: UseLoginFormProps = {}) => {
  const { login, isLoginPending, clearError } = useAuth()

  const form = useForm<LoginCredentials>({
    initialValues: {
      email: '',
      password: '',
    },

    validate: {
      email: (value) => {
        if (!value) return 'Email is required'
        if (!/^\S+@\S+$/.test(value)) return 'Invalid email format'
        return null
      },
      password: (value) => {
        if (!value) return 'Password is required'
        if (value.length < 6) return 'Password must be at least 6 characters'
        return null
      },
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      clearError()
      await login(values)
      onSuccess?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      onError?.(message)
    }
  })

  return {
    form,
    handleSubmit,
    isLoading: isLoginPending,
  }
}

export const useRegisterForm = ({ onSuccess, onError }: UseRegisterFormProps = {}) => {
  const { register, isRegisterPending, clearError } = useAuth()

  const form = useForm<RegisterCredentials & { confirmPassword: string }>({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },

    validate: {
      name: (value) => {
        if (!value) return 'Name is required'
        if (value.length < 2) return 'Name must be at least 2 characters'
        return null
      },
      email: (value) => {
        if (!value) return 'Email is required'
        if (!/^\S+@\S+$/.test(value)) return 'Invalid email format'
        return null
      },
      password: (value) => {
        if (!value) return 'Password is required'
        if (value.length < 6) return 'Password must be at least 6 characters'
        return null
      },
      confirmPassword: (value, values) => {
        if (!value) return 'Please confirm your password'
        if (value !== values.password) return 'Passwords do not match'
        return null
      },
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      clearError()
      const { confirmPassword, ...registerData } = values
      await register(registerData)
      onSuccess?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      onError?.(message)
    }
  })

  return {
    form,
    handleSubmit,
    isLoading: isRegisterPending,
  }
}
