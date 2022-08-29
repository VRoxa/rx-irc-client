import { filter, firstValueFrom, fromEvent, map, Observable } from 'rxjs';
import { AsyncSocket } from './async-socket';
import { IrcSocketOptions } from './models/irc-socket-options.model';
import { expandAs, fromSocketEvent } from './utils/rx-operators';

export class IrcSocket {

  private socket: AsyncSocket;
  private connected: boolean = false;

  // Observables
  public messageReceived$: Observable<string>;
  public errors$: Observable<any>;
  public ircErrors$: Observable<string>;
  public pings$: Observable<string>;

  constructor(private options: IrcSocketOptions) {
    this.socket = new AsyncSocket({
      writable: true,
      readable: true
    });

    // TODO - Unsubscribe when disposing...
    fromSocketEvent<void>(this.socket, 'connect').subscribe(() => {
      this.connected = true;
    });

    // Message reveived stream.
    this.messageReceived$ = fromSocketEvent<any>(this.socket, 'data')
      .pipe(
        // Convert buffer to string
        map(data => <string>data.toString()),
        // Expand multiple lines into values in stream
        expandAs(message => message.split('\n')),
        // Filter empty messages
        filter(message => !!message)
      );

    this.errors$ = fromSocketEvent(this.socket, 'error');

    const serverEvents$ = this.messageReceived$.pipe(
      map(msg => {
        const [command, message] = msg.split(' ');
        return { command, message };
      })
    );

    this.ircErrors$ = serverEvents$.pipe(
      filter(({ command }) => command === 'ERROR'),
      map(({ message }) => message)
    );

    this.pings$ = serverEvents$.pipe(
      filter(({ command }) => command === 'PING'),
      map(({ message }) => message)
    );
  }

  private get ident() {
    return this.options.user.ident ?? 'RX-IRC-Client Session';
  }

  public get isConnected() {
    return this.connected;
  }

  public sendAsync = async (message: string) => {
    if (!this.connected) {
      throw new Error(
        `Cannot send message. Socket ${this.options.host}:${this.options.port} is disconnected
        [Message: ${message}]`
      );
    }

    await this.socket.writeAsync(message);
  }

  public disconnect = async (quitReason?: string) => {
    if (!this.connected) {
      throw new Error(`Cannot disconnect. Socket ${this.options.host}:${this.options.port} is already disconnected`);
    }

    await this.socket.writeAsync(`QUIT :${quitReason ?? 'Client disconnection'}`);
    // Wait for server response.
    await firstValueFrom(this.ircErrors$);

    this.socket.destroy();
    this.connected = false;
  };

  public connectAsync = async () => {
    if (this.connected) {
      throw new Error(`Cannot connect. Socket ${this.options.host}:${this.options.port} is already connected`);
    }

    this.socket.connect({
      port: this.options.port ?? 6667,
      host: this.options.host
    });

    // After connecting, wait for the 'ready' stream to emit.
    await this.waitUntilSocketReady();
    
    // Send server PASSWORD if set.
    !!this.options.password ?? await this.socket.writeAsync(`PASS ${this.options.password}`);

    // Start USER registration request.
    await this.socket.writeAsync(`NICK ${this.options.user.nick}`);
    await this.socket.writeAsync(`USER ${this.options.user.nick} 0 * ${this.ident}`);

    // Wait for PING message and respond with PONG reply.
    const phrase = await this.waitUntilPingReceived();
    await this.socket.writeAsync(`PONG ${phrase}`);

    await this.waitUntilRegistrationEnd();
  }

  private waitUntilSocketReady = () => {
    return firstValueFrom(fromEvent(this.socket, 'ready'));
  }

  private waitUntilPingReceived = () => {
    return firstValueFrom(this.pings$);
  }

  private waitUntilRegistrationEnd = () => {
    // Wait for registration process server messages
    // Mandatory: RPL_MYINFO (004), RPL_ISUPPORT (005)
    // Optional: RPL_ENDOFMOTD (376)
    return firstValueFrom(this.messageReceived$.pipe(
      filter(message => {
        const [_, msgCode] = message.split(' ');
        return ['004', '005', '376'].includes(msgCode);
      })
    ));
  }
}
