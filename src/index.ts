import { Subscription } from 'rxjs';
import { IrcClient } from './irc-client';
import options from './connection-opts';

let subscriptions: Subscription[] = [];

const main = async () => {

  const client = await IrcClient.from(options, true);

  const s0 = client.channelMessages$.subscribe(({ message, user, channel }) => {
    console.info(`[${channel}] (${user.nick}): ${message}`);
  });

  const s1 = client.privateMessages$.subscribe(async ({ message, user }) => {
    console.info(`[PRIVATE] (${user.nick}): ${message}`);
    await client.write(user.nick, `Hello, ${user.nick}. How are you doing?`);
  });

  const s2 = client.channelInOut$.subscribe(({ user, action, channel, reason }) => {
    console.info(`${user.nick} ${action} ${channel ?? reason}`);
  });

  const s3 = client.serverMessages$.subscribe(({ command, channel, message }) => {
    console.info(`(Server) ${command} ${channel ?? ''}: ${message}`);
  });

  subscriptions = [s0, s1, s2, s3];
}

main().catch(err => {
  console.error('Program terminated with error', err);

  // Unsubscribe from existing hot observables.
  subscriptions.forEach(subscription => {
    subscription.unsubscribe();
  });
});
