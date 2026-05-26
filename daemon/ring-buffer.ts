const MAX_BYTES = 1024 * 1024 // 1MB per session

export class RingBuffer {
  private chunks: Buffer[] = []
  private totalBytes = 0

  append(data: string) {
    const buf = Buffer.from(data, 'utf-8')
    this.chunks.push(buf)
    this.totalBytes += buf.byteLength
    // evict from front until under limit
    while (this.totalBytes > MAX_BYTES && this.chunks.length > 0) {
      const evicted = this.chunks.shift()!
      this.totalBytes -= evicted.byteLength
    }
  }

  getAll(): string {
    return Buffer.concat(this.chunks).toString('utf-8')
  }

  clear() {
    this.chunks = []
    this.totalBytes = 0
  }
}
