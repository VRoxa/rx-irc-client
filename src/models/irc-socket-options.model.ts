
export interface IrcUser {
  nick: string;
  ident?: string;
  password?: string;
}

export interface IrcSocketOptions {
  host: string;
  port?: number;
  password?: string;
  user: IrcUser
}
