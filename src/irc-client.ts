import { filter, map, Observable } from 'rxjs';
import { IrcSocket } from './irc-socket';
import { IrcSocketOptions } from './models/irc-socket-options.model';
import { UserInfo } from './models/user-info.model';
import { getUserInfo, isUser } from './utils/username-utils';

export class IrcClient {

  private socket: IrcSocket;

  // Observables
  public channelMessages$: Observable<{
    message: string;
    user: UserInfo;
    channel: string;
  }>;

  public privateMessages$: Observable<{
    message: string;
    user: UserInfo;
  }>;

  public channelInOut$: Observable<{
    user: UserInfo;
    action: string;
    channel?: string;
    reason?: string;
  }>;

  public serverMessages$: Observable<{
    command: string;
    channel: string;
    message: string;
  }>;

  private constructor(private options: IrcSocketOptions) {
    this.socket = new IrcSocket(options);

    const messageReceived$ = this.socket.messageReceived$.pipe(
      map(message => {
        const [_, info, ...msg] = message.split(':');
        return { info, message: msg.join(':') };
      }),
      filter(({ info }) => !!info),
      map(({ info, message }) => ({
        info,
        message,
        preparedInfo: info.split(' ')
      }))
    );

    this.serverMessages$ = messageReceived$.pipe(
      filter(({ preparedInfo: [userInfo] }) => !isUser(userInfo)),
      map(({ message, preparedInfo: [_, command, __, channel] }) => ({
        command,
        channel,
        message
      }))
    );

    const userActions$ = messageReceived$.pipe(
      filter(({ preparedInfo: [userInfo] }) => isUser(userInfo))
    );

    this.channelInOut$ = userActions$.pipe(
      filter(({ preparedInfo: [_, command] }) => ['PART', 'JOIN', 'QUIT'].includes(command)),
      map(({ message, preparedInfo: [userInfo, command] }) => ({
        user: getUserInfo(userInfo),
        action: command,
        channel: ['PART', 'JOIN'].includes(command) ? message : undefined,
        reason: command === 'QUIT' ? message : undefined
      }))
    );

    const userMessages$ = userActions$.pipe(
      filter(({ preparedInfo: [_, command] }) => command === 'PRIVMSG')
    );

    this.channelMessages$ = userMessages$.pipe(
      filter(({ preparedInfo: [_, __, target] }) => /^#/.test(target)),
      map(({ message, preparedInfo: [userInfo, _, channel] }) => ({
        message,
        user: getUserInfo(userInfo),
        channel: channel
      }))
    );

    this.privateMessages$ = userMessages$.pipe(
      filter(({ preparedInfo: [_, __, target] }) =>
        target === this.options.user.nick
      ),
      map(({ message, preparedInfo: [userInfo] }) => ({
        message,
        user: getUserInfo(userInfo),
      }))
    )
  }

  // Static asynchronous constructor.
  public static from = async (
    options: IrcSocketOptions,
    autoconnect: boolean = false
  ) => {
    const client = new IrcClient(options);
    autoconnect && await client.connectAsync();
    return client;
  }

  public connectAsync = async () => {
    await this.socket.connectAsync();

    this.socket.messageReceived$.subscribe(message => {
      // console.log(`[RAW_DATA]: ${message}`);
    });

    // Reply to PING messages
    this.socket.pings$.subscribe(async phrase => {
      console.log(`PING received. Responding PONG... ${phrase}`);
      await this.socket.sendAsync(`PONG ${phrase}`);
    });

    // Subscribe to IRC errors.
    this.socket.ircErrors$.subscribe(msg => {
      console.warn(`[ERROR] ${msg}`);
    });
  }

  public join = async (channel: string) => {
    await this.socket.sendAsync(`JOIN #${channel}`);
  }

  public write = async (receiver: string, message: string) => {
    await this.socket.sendAsync(`PRIVMSG ${receiver} :${message}`);
  }
}
