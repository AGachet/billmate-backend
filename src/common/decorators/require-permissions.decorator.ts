import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS_KEY = 'permissions'
export const MODULE_KEY = 'required_module'

export interface PermissionRequirement {
  module: string
  permissions: string[]
}

export const RequirePermissions = (permissions: string[], module: string) => {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    SetMetadata(PERMISSIONS_KEY, permissions)(target, key!, descriptor!)
    SetMetadata(MODULE_KEY, module)(target, key!, descriptor!)
    return descriptor
  }
}
