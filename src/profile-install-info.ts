export interface ProfileInstallInfo {
  id: string
  name: string
  color: string
  description: string
  install: {
    win: string
    mac: string
    linux: string
    url: string
  }
}

export const PROFILE_INSTALL_INFO: ProfileInstallInfo[] = []
