export interface Business {
  id: string
  name: string
  description: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateBusinessDto {
  name: string
  description: string
  userId: string
}

export interface UpdateBusinessDto {
  name?: string
  description?: string
}
