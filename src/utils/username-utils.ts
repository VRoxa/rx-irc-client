import { UserInfo } from '../models/user-info.model';

const userRegEx = /^(?<nick>\b[^](?<ident>.*?))!([^\s])+@(?<virtualip>\b[^]*(.*?))$/;

export const isUser = (text: string): boolean => {
  return userRegEx.test(text);
}

export const getUserInfo = (text: string): UserInfo => {
  const match = userRegEx.exec(text);
  if (!match) {
    throw new Error(
      `Cannot get user information.
      Input ${text} does not correspond to a valid user format.`
    );
  }

  const { groups } = match;
  return {
    nick: groups!.nick,
    ident: groups!.ident,
    virtualIp: groups!.virtualp
  };
}
