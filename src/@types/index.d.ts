declare module '@via-profit/dataloader' {
  import { Redis } from 'ioredis';

  export type Node<T> = T & {
    id: string;
  }

  export type BatchLoadFn<T> = (keys: ReadonlyArray<string>) => Promise<ReadonlyArray<Node<T>>>;

  export type Batch<T> = {
    hasDispatched: boolean,
    keys: Set<string>;
    cache: Map<string, {
      promise: Promise<Node<T>>,
      expires: number,
    }>;
    callbacks: Map<string, {
      resolve: (value: Node<T>) => void;
      reject: (error: Error) => void;
    }>,
  };

  export type MaybePromise<T> = T | Promise<T>;

  export type DataLoaderProps = RedisCacheProps & {
    /**
     * Limits the number of items that get passed in to the batchLoadFn.\
     * May be set to 1 to disable batching.\
     * \
     * Default: `Infinity`
     */
    maxBatchSize?: number;
  };

  export type RedisCacheProps = {
    /**
     * Redis IO instance from package `ioredis`
     */
    redis: Redis;

    /**
     * Each dataloader creates its own cache in Redis.\
     * Therefore, the `cacheName` must be a unique key in Redis.\
     * It is better to use a meaningful name for the `cacheName`\
     * \
     * For Example: `books`
     */
    cacheName: string;

    /**
     * Default value of expiration time of each value placed in the cache\
     * It will be used in cases of calling 'load` without the expires argument.\
     * Format: digit + entity.
     * 
     * For example: `defaultExpiration: 36000`; `defaultExpiration: '12 days'`; `defaultExpiration: '4.5h'`;\
     * \
     * Default: `0`
     */
    defaultExpiration?: string | number;
  }

  export interface DataloaderInterface<T> {

    /**
     * Loads one entity.\
     * \
     * You can pass the `expires` argument to set expires time cache.
     * If `expires` argument not passed, then will be used `defaultExpiration` property
     * To prevent the loaded value from being cached, pass `0` as second argument.
     * Format: digit + entity.
     * 
     * For example: `load(id, 36000)`; `load(id, '12 days')`; `load(id, '4.5h')`
     */
    load(key: string, expires?: string | number): Promise<Node<T> | null>;
    loadMany(keys: ReadonlyArray<string>): Promise<Node<T>[]>
    clear(key: string): Promise<this>;
    clearMany(keys: string[]): Promise<this>;
    clearAll(): Promise<this>;
    prime(value: Node<T>, expires?: string | number): Promise<this>;
    primeMany(values: Node<T>[], expires?: string | number): Promise<this>;
  }

  export class RedisCache<T> {
    constructor(props: RedisCacheProps);
    get(key: string): MaybePromise<T | null>;
    set(key: string, value: T, expires?: string | number): MaybePromise<void>;
    delele(key: string | string[]): MaybePromise<void>;
    clear(): MaybePromise<void>;
  }

  interface DataLoader<T> extends DataloaderInterface<T> {}

  class DataLoader<T> {
    constructor(batchLoadFn: BatchLoadFn<T>, props: DataLoaderProps);
  }

  export default DataLoader;
  
}