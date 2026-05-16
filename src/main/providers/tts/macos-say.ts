import { spawn, ChildProcess } from 'child_process'
import type { TTSAdapter } from './interface'

export class MacOSSayAdapter implements TTSAdapter {
  private process?: ChildProcess

  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('say', [text])
      this.process.on('close', (code) => {
        if (code === 0 || code === null) resolve()
        else reject(new Error(`say exited with code ${code}`))
      })
      this.process.on('error', reject)
    })
  }

  stop(): void {
    this.process?.kill('SIGTERM')
  }
}
