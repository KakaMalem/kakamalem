"use client";

/**
 * Thermal Printer Service
 *
 * Uses Web Serial API to communicate directly with thermal receipt printers.
 * Supports ESC/POS command set which is standard for most thermal printers.
 *
 * Browser support: Chrome 89+, Edge 89+ only
 */

// Web Serial API type declarations (Chrome/Edge only)
declare global {
  interface Navigator {
    serial: Serial;
  }

  interface Serial {
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  }

  interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
  }

  interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
  }

  interface SerialPort {
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
  }

  interface SerialOptions {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: "none" | "even" | "odd";
    bufferSize?: number;
    flowControl?: "none" | "hardware";
  }
}

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const COMMANDS = {
  INIT: [ESC, 0x40], // Initialize printer
  CUT: [GS, 0x56, 0x00], // Full cut
  PARTIAL_CUT: [GS, 0x56, 0x01], // Partial cut
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_WIDTH: [GS, 0x21, 0x10],
  DOUBLE_HEIGHT: [GS, 0x21, 0x01],
  DOUBLE_SIZE: [GS, 0x21, 0x11], // Double width and height
  NORMAL_SIZE: [GS, 0x21, 0x00],
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  FEED_LINES: (n: number) => [ESC, 0x64, n],
};

export type ReceiptData = {
  storeName: string;
  storePhone?: string | null;
  storeAddress?: string | null;
  receiptNumber: string;
  orderNumber?: string;
  date: string;
  customerName?: string | null;
  items: Array<{
    name: string;
    variantName?: string | null;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  changeDue?: number;
  paymentMethod?: string | null;
  currency: string;
  footerText?: string | null;
  paperWidth: "58mm" | "80mm";
};

export class ThermalPrinterService {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private charsPerLine: number = 48; // 80mm default

  /**
   * Check if Web Serial API is supported in this browser
   */
  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  /**
   * Request user to select a serial port and connect to it
   */
  async connect(): Promise<boolean> {
    if (!ThermalPrinterService.isSupported()) {
      throw new Error(
        "Web Serial API not supported. Please use Chrome or Edge."
      );
    }

    try {
      // Request a port from the user
      this.port = await navigator.serial.requestPort();

      // Open the port with common thermal printer settings
      await this.port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      // Get a writer for the port
      this.writer = this.port.writable?.getWriter() || null;

      if (!this.writer) {
        throw new Error("Could not get writer for serial port");
      }

      return true;
    } catch (error) {
      // User cancelled or connection failed
      this.port = null;
      this.writer = null;

      if (error instanceof DOMException && error.name === "NotFoundError") {
        // User cancelled the port selection
        return false;
      }

      throw error;
    }
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    try {
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch {
      // Ignore errors during disconnect
      this.writer = null;
      this.port = null;
    }
  }

  /**
   * Check if currently connected to a printer
   */
  isConnected(): boolean {
    return this.port !== null && this.writer !== null;
  }

  /**
   * Write raw bytes to the printer
   */
  private async write(data: number[] | Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error("Printer not connected");
    }
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    await this.writer.write(bytes);
  }

  /**
   * Write text to the printer (UTF-8 encoded)
   */
  private async writeText(text: string): Promise<void> {
    await this.write(this.encoder.encode(text));
  }

  /**
   * Write a line of text followed by a line feed
   */
  private async writeLine(text: string = ""): Promise<void> {
    await this.writeText(text);
    await this.write([LF]);
  }

  /**
   * Format a price with currency
   */
  private formatPrice(amount: number, currency: string): string {
    return `${amount.toLocaleString()} ${currency}`;
  }

  /**
   * Format a line with left and right aligned text
   */
  private formatLineItem(left: string, right: string): string {
    const maxLeft = this.charsPerLine - right.length - 1;
    const truncatedLeft =
      left.length > maxLeft ? left.substring(0, maxLeft - 1) + "..." : left;
    const padding = this.charsPerLine - truncatedLeft.length - right.length;
    return truncatedLeft + " ".repeat(Math.max(1, padding)) + right;
  }

  /**
   * Create a separator line
   */
  private separator(char: string = "-"): string {
    return char.repeat(this.charsPerLine);
  }

  /**
   * Print a complete receipt
   */
  async printReceipt(data: ReceiptData): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Printer not connected");
    }

    // Set characters per line based on paper width
    this.charsPerLine = data.paperWidth === "58mm" ? 32 : 48;

    try {
      // Initialize printer
      await this.write(COMMANDS.INIT);

      // Store name (bold, centered, double size)
      await this.write(COMMANDS.ALIGN_CENTER);
      await this.write(COMMANDS.BOLD_ON);
      await this.write(COMMANDS.DOUBLE_SIZE);
      await this.writeLine(data.storeName);
      await this.write(COMMANDS.NORMAL_SIZE);
      await this.write(COMMANDS.BOLD_OFF);

      // Phone and address
      if (data.storePhone) {
        await this.writeLine(data.storePhone);
      }
      if (data.storeAddress) {
        await this.writeLine(data.storeAddress);
      }

      await this.write(COMMANDS.ALIGN_LEFT);
      await this.writeLine(this.separator());

      // Receipt info
      await this.writeLine(`Receipt: ${data.receiptNumber}`);
      if (data.orderNumber) {
        await this.writeLine(`Order: ${data.orderNumber}`);
      }
      await this.writeLine(`Date: ${data.date}`);
      if (data.customerName) {
        await this.writeLine(`Customer: ${data.customerName}`);
      }

      await this.writeLine(this.separator());

      // Items
      for (const item of data.items) {
        const itemName = item.variantName
          ? `${item.name} (${item.variantName})`
          : item.name;
        const itemTotal = item.quantity * item.price;

        // Item name (may wrap if long)
        await this.writeLine(`${item.quantity}x ${itemName}`);
        // Price aligned right
        await this.writeLine(
          this.formatLineItem("", this.formatPrice(itemTotal, data.currency))
        );
      }

      await this.writeLine(this.separator());

      // Subtotal (if different from total due to discount)
      if (data.discount > 0) {
        await this.writeLine(
          this.formatLineItem(
            "Subtotal",
            this.formatPrice(data.subtotal, data.currency)
          )
        );
        await this.writeLine(
          this.formatLineItem(
            "Discount",
            `-${this.formatPrice(data.discount, data.currency)}`
          )
        );
      }

      // Total (bold)
      await this.write(COMMANDS.BOLD_ON);
      await this.write(COMMANDS.DOUBLE_HEIGHT);
      await this.writeLine(
        this.formatLineItem(
          "TOTAL",
          this.formatPrice(data.total, data.currency)
        )
      );
      await this.write(COMMANDS.NORMAL_SIZE);
      await this.write(COMMANDS.BOLD_OFF);

      await this.writeLine(this.separator());

      // Payment info
      if (data.paymentMethod) {
        await this.writeLine(`Payment: ${data.paymentMethod}`);
      }
      await this.writeLine(
        this.formatLineItem(
          "Amount Paid",
          this.formatPrice(data.amountPaid, data.currency)
        )
      );

      // Change due (if applicable)
      if (data.changeDue && data.changeDue > 0) {
        await this.writeLine(
          this.formatLineItem(
            "Change",
            this.formatPrice(data.changeDue, data.currency)
          )
        );
      }

      // Payment status
      await this.writeLine(this.separator());
      await this.write(COMMANDS.ALIGN_CENTER);
      await this.write(COMMANDS.BOLD_ON);

      if (data.amountPaid >= data.total) {
        await this.writeLine("** PAID **");
      } else if (data.amountPaid > 0) {
        await this.writeLine("** PARTIAL PAYMENT **");
        await this.write(COMMANDS.BOLD_OFF);
        await this.writeLine(
          `Due: ${this.formatPrice(data.total - data.amountPaid, data.currency)}`
        );
      } else {
        await this.writeLine("** UNPAID **");
      }
      await this.write(COMMANDS.BOLD_OFF);

      // Footer text
      if (data.footerText) {
        await this.writeLine("");
        await this.writeLine(data.footerText);
      }

      // Feed paper and cut
      await this.write(COMMANDS.FEED_LINES(4));
      await this.write(COMMANDS.PARTIAL_CUT);
    } catch (error) {
      // If there's an error during printing, try to reset the printer
      try {
        await this.write(COMMANDS.INIT);
      } catch {
        // Ignore reset errors
      }
      throw error;
    }
  }

  /**
   * Print a test receipt to verify printer connection
   */
  async printTest(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Printer not connected");
    }

    await this.write(COMMANDS.INIT);
    await this.write(COMMANDS.ALIGN_CENTER);
    await this.write(COMMANDS.BOLD_ON);
    await this.writeLine("PRINTER TEST");
    await this.write(COMMANDS.BOLD_OFF);
    await this.writeLine("");
    await this.writeLine("If you can read this,");
    await this.writeLine("your printer is working!");
    await this.writeLine("");
    await this.writeLine(new Date().toLocaleString());
    await this.write(COMMANDS.FEED_LINES(3));
    await this.write(COMMANDS.PARTIAL_CUT);
  }
}

// Singleton instance for the app
let printerInstance: ThermalPrinterService | null = null;

/**
 * Get the singleton thermal printer instance
 */
export function getThermalPrinter(): ThermalPrinterService {
  if (!printerInstance) {
    printerInstance = new ThermalPrinterService();
  }
  return printerInstance;
}
