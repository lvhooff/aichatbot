import { spawn, ChildProcess } from 'child_process'
import type { TTSAdapter } from './interface'

export class MacOSSayAdapter implements TTSAdapter {
  private process?: ChildProcess
  private stopped = false

  speak(text: string): Promise<void> {
    this.stop()
    this.stopped = false
    return new Promise((resolve, reject) => {
      this.process = spawn('say', [text])
      this.process.on('close', (code, signal) => {
        // Killed by SIGTERM (stop() was called) — treat as graceful cancellation.
        if (this.stopped || signal === 'SIGTERM' || code === 0 || code === null) {
          resolve()
        } else {
          reject(new Error(`say exited with code ${code}`))
        }
      })
      this.process.on('error', reject)
    })
  }

  stop(): void {
    if (this.process) {
      this.stopped = true
      this.process.kill('SIGTERM')
    }
  }
}
