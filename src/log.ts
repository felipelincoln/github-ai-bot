function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function timestamp(): string {
  const d = new Date()
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${date}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

export function log(module: string, msg: string): void {
  process.stdout.write(`${timestamp()} [${module}] ${msg}\n`)
}
