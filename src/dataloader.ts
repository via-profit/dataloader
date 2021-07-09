import {
  Node,
  Batch,
  BatchLoadFn,
  DataloaderInterface,
  RedisCache as CacheInterface,
  DataLoaderProps,
} from '@via-profit/dataloader';

import RedisCache from './dataloader-cache';
import mslight from './time-parser';

let resolvedPromise: Promise<any> | null;

/**
 * DataLoader
 */
class DataLoader<T> implements DataloaderInterface<T> {
  #batchLoadFn: BatchLoadFn<T> | null = null;
  #cache: CacheInterface<Node<T>> = null;
  #defaultExpiration = 0;
  #maxBatchSize = Infinity;
  #batch: Batch<T> | null = null;

  public constructor(batchLoadFn: BatchLoadFn<T>, props: DataLoaderProps) {
    const { redis, defaultExpiration, cacheName, maxBatchSize } = props || {};

    this.#defaultExpiration = mslight(defaultExpiration);
    this.#batchLoadFn = batchLoadFn;
    this.#maxBatchSize = typeof maxBatchSize !== 'undefined' ? maxBatchSize : this.#maxBatchSize;
    this.#cache = new RedisCache({
      defaultExpiration,
      cacheName,
      redis,
    });

    if (typeof batchLoadFn !== 'function') {
      throw new TypeError(
        'DataLoader must be constructed with a function which accepts ' +
          `Array<key> and returns Promise<Array<value>>, but got: ${batchLoadFn}.`,
      );
    }
  }

  private async dispatch(batch: Batch<T>) {
    // Mark this batch as having been dispatched.
    batch.hasDispatched = true;

    // If there's nothing to load, then return early.
    if (!batch.keys.size) {
      return;
    }

    const keys = Array.from(batch.keys);
    const cachedKeys: string[] = [];

    await keys.reduce(async (prev, key) => {
      await prev;
      const cachedNode = await this.#cache.get(key);
      if (cachedNode?.id) {
        cachedKeys.push(cachedNode.id);

        const promise = batch.callbacks.get(cachedNode.id);
        if (promise) {
          promise.resolve(cachedNode);
        } else {
          console.error(`Dataloader dispatch error of key «${cachedNode.id}»`);
          batch.callbacks.delete(cachedNode.id);
        }
      }
    }, Promise.resolve());

    const batchKeys = keys.filter(key => !cachedKeys.includes(key));

    if (batchKeys.length === 0) {
      return;
    }

    try {
      const values = await this.#batchLoadFn(batchKeys);
      batchKeys.forEach(key => {
        const node = values.find(data => data?.id === key);
        const resolver = batch.callbacks.get(key);
        const nodeCache = batch.cache.get(key);

        if (node !== null && typeof node !== 'undefined' && nodeCache?.expires > 0) {
          this.#cache.set(key, node, nodeCache.expires);
        }

        resolver.resolve(node || null);
      });
    } catch (error) {
      keys.forEach(key => {
        const resolver = batch.callbacks.get(key);
        resolver?.reject(error);
      });
    }
  }

  private getBatch(): Batch<T> {
    const existingBatch = this.#batch;

    if (
      existingBatch &&
      !existingBatch.hasDispatched &&
      existingBatch.keys.size < this.#maxBatchSize
    ) {
      return existingBatch;
    }

    // create batch
    const newBatch: Batch<T> = {
      hasDispatched: false,
      keys: new Set(),
      cache: new Map(),
      callbacks: new Map(),
    };

    this.#batch = newBatch;

    (resolvedPromise ?? Promise.resolve()).then(() => {
      process.nextTick(() => {
        this.dispatch(newBatch);
      });
    });

    return newBatch;
  }

  /**
   * Loads a key, returning a `Promise` for the value represented by that key.
   */
  public async load(key: string, expiresStr?: string | number): Promise<Node<T>> {
    if (key === null || key === undefined) {
      throw new TypeError(
        'The loader.load() function must be called with a value, ' + `but got: ${String(key)}.`,
      );
    }

    if (typeof key !== 'string') {
      throw new TypeError('Loaded key must be a string type, ' + `but got: ${typeof key}.`);
    }

    // create batch
    const batch = this.getBatch();

    // Promises cache
    if (batch.cache.has(key)) {
      return batch.cache.get(key).promise;
    }

    // create promise to return it and cached
    const promise = new Promise<Node<T>>((resolve, reject) => {
      batch.callbacks.set(key, { resolve, reject });
    });

    const expires = mslight(
      typeof expiresStr !== 'undefined' ? expiresStr : this.#defaultExpiration,
    );

    batch.keys.add(key);
    batch.cache.set(key, {
      promise,
      expires,
    });

    return promise;
  }

  public async reload(key: string, expiresStr?: string | number): Promise<Node<T>> {
    await this.clear(key);

    return this.load(key, expiresStr);
  }

  public async loadMany(keys: ReadonlyArray<string>): Promise<Node<T>[]> {
    const loadPromises: Array<Promise<Node<T>>> = [];

    keys.forEach(key => {
      loadPromises.push(this.load(key).catch(error => error));
    });

    return Promise.all(loadPromises);
  }

  public async prime(value: Node<T>, expiresStr?: string | number) {
    if (typeof value?.id === 'undefined') {
      throw new TypeError(
        'Value must contain «id» field. This id must be unique of this dataloader collection, ' +
          `but got: ${String(value?.id)}.`,
      );
    }

    if (typeof value.id !== 'string') {
      throw new TypeError(
        'Value field «id» must be a string type, ' + `but got: ${typeof value.id}.`,
      );
    }

    const promise = Promise.resolve(value);
    const batch = this.getBatch();
    const expires = mslight(
      typeof expiresStr !== 'undefined' ? expiresStr : this.#defaultExpiration,
    );

    batch.cache.set(value.id, {
      promise,
      expires,
    });

    if (expires > 0) {
      this.#cache.set(value.id, value, expires);
    }
  }

  public async primeMany(values: Node<T>[], expiresStr?: string | number) {
    await values.reduce(async (prev, value) => {
      await prev;

      this.prime(value, expiresStr);
    }, Promise.resolve());
  }

  public async clear(key: string) {
    if (typeof key !== 'string') {
      throw new TypeError('Cleared key must be a string type, ' + `but got: ${typeof key}.`);
    }

    if (this.#batch) {
      this.#batch.cache.delete(key);
      this.#batch.callbacks.delete(key);
    }
    await this.#cache.delele(key);
  }

  public async clearMany(keys: string[]) {
    await Promise.all(keys.map(key => this.clear(key)));
  }

  public async clearAll() {
    if (this.#batch) {
      this.#batch.cache.clear();
      this.#batch.callbacks.clear();
    }

    this.#cache.clear();
  }
}

export default DataLoader;
