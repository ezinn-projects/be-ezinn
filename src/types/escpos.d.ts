declare module 'escpos' {
  export class Printer {
    constructor(device: any)
    font(font: string): this
    align(align: 'lt' | 'ct' | 'rt'): this
    style(style: 'b' | 'i' | 'u'): this
    size(width: number, height: number): this
    text(text: string | Buffer): this
    drawLine(): this
    cut(): this
    close(callback?: () => void): void
    encoding: string
    codepage(codepage: string): this
    image(image: Buffer, mode: string, callback?: (error: Error | null) => void): this
  }

  export const USB: any
}

declare module 'escpos-usb' {
  export class USB {
    static findPrinter(): any[]
    constructor(device: any)
    open(callback: (error: Error | null) => void): void
  }
}
