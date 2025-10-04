declare module 'screenshot-desktop' {
  interface ScreenshotOptions {
    filename?: string;
    screen?: number;
    format?: 'png' | 'jpg';
  }

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  
  export default screenshot;
}

