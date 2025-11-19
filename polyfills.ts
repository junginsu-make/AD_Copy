// EC2 배포용 File 객체 polyfill
if (typeof globalThis !== 'undefined' && typeof globalThis.File === 'undefined') {
  class FilePolyfill {
    name: string;
    lastModified: number;
    
    constructor(bits: any[], name: string, options?: any) {
      this.name = name;
      this.lastModified = Date.now();
    }
  }
  
  (globalThis as any).File = FilePolyfill;
}

export {};

