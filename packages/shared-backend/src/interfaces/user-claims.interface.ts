export interface UserClaims {
  id: string
  email: string
  name: string
}

export interface MessageWithUserClaims {
  userClaims: UserClaims
}
