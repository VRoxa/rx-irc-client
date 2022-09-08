import { Socket } from 'net';
import { concatMap, delay, from, fromEvent, mergeMap, Observable, of, OperatorFunction } from 'rxjs';
import { EventEmitter } from 'stream';

export const expandAs = <T>(
  projectFn: (value: T) => T[]
): OperatorFunction<T, T> => {
  return (source: Observable<T>) => {
    return source.pipe(
      mergeMap((value: T) => {
        const values = projectFn(value);
        return from(values);
      })
    );
  }
}

export const fromSocketEvent = <T, TSocket extends EventEmitter = Socket>(
  socket: TSocket,
  eventName: string
): Observable<T> => {
  return fromEvent(socket, eventName) as Observable<T>;
}

export const synchronize = <T>(source: Observable<T>) => {
  return source.pipe(
    concatMap(x => of(x).pipe(delay(0)))
  );
}
