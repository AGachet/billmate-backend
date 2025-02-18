export enum UserRoles {
  GUEST = 1,
  USER = 2,
  ADMIN = 3,
  SUPERADMIN = 4
}

export enum Locales {
  FR = 'FR',
  EN = 'EN'
}

export const UserDefaults = {
  roles: {
    default: UserRoles.USER
  },
  preferences: {
    locale: Locales.EN
  }
} as const
