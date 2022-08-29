import { Socket, SocketConstructorOpts } from 'net';

export class AsyncSocket extends Socket {

  constructor(options: SocketConstructorOpts) {
    super(options);
  }

  public writeAsync = (message: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const handleError = (error: Error | undefined) => {
        !!error ? reject(error) : resolve();
      }

      this.write(`${message}\r\n`, 'utf-8', handleError);
    });
  }
}
