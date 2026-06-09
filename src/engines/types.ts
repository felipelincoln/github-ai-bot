export interface AuthDescriptor {
  mode: 'login-command' | 'paste-token'
  command?: string
  placeholder?: string
  tokenEnvVar?: string
}

export interface EngineWarning {
  text: string
  url: string
}

export interface Engine {
  id: string
  label: string
  recommended: boolean
  auth: AuthDescriptor
  warning?: EngineWarning
  models?: string[]
  efforts?: string[]
  isConfigured(): boolean
  prepare?(): void
}

export interface EngineMeta {
  id: string
  label: string
  recommended: boolean
  auth: {
    mode: AuthDescriptor['mode']
    command: string | null
    placeholder: string | null
    tokenEnvVar: string | null
  }
  warning: EngineWarning | null
  models: string[]
  efforts: string[]
  configured: boolean
}
