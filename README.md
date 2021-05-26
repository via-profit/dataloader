# Via Profit / dataloader

![npm (scoped)](https://img.shields.io/npm/v/@via-profit/dataloader?color=blue)
![NPM](https://img.shields.io/npm/l/@via-profit/dataloader?color=blue)
![npm bundle size (scoped)](https://img.shields.io/bundlephobia/minzip/@via-profit/dataloader?color=green)

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [API](#api)

## <a name="overview"></a> Overview

This module is a fork of the package [GraphQL DataLoader](https://github.com/graphql/dataloader) with some changes to allow the use of Redis cache with the ability to specify the expiration time of each of its elements.

## <a name="installation"></a> Installation

We used [IO Redis](https://github.com/luin/ioredis#readme) package as Redis client. You must install this dependency to.

```bash
# yarn
yarn add @via-profit/dataloader ioredis

# npm
npm i @via-profit/dataloader ioredis
```

## <a name="getting-started"></a> Getting Started

Setup Reids using `ioredis` and pass it to constructor.

```ts
import DataLoader from '@via-profit/dataloader';
import Redis from 'ioredis';

const redis = new Redis();
const loader = new DataLoader({
  // ioredis instance
  redis,

  // Each dataloader creates its own cache in Redis.
  // Therefore, the `cacheName` must be a unique key in Redis.
  // It is better to use a meaningful name for the `cacheName`
  cacheName: 'books',

  // Default value of expiration time of each value placed in the cache
  // It will be used in cases of calling 'load` without the expires argument.
  // Format: digit + entity
  defaultExpiration: '12 hours',
});

// Now you can start the load your data
loader.load('fde7fcf7-984d-44b8-8504-d6347e105f56');
loader.load('34bcab6b-7207-4883-a442-92d21e53d31d');
loader.loadMany(['e3fd7057-858b-43f9-b276-0c631e0de1af', 'ba995e24-0d05-4de4-a12c-756c009f3620']);
```

## <a name="api"></a> API

Use TypeScript for more data abot API and arguments

| Name        | Arguments |     Return type     | Description                                |
| :---------- |:- | :-----------------: | :----------------------------------------- |
| `load`      | key: `string`, [expires: `string \| number`] | `Promise<T\|null>` | Loads one entity by key                     |
| `reload`      | key: `string`, [expires: `string \| number`] | `Promise<T\|null>` | Loads one entity by key and ignore cache, but put loaded data into the cache                     |
| `loadMany`  | keys: `string[]` | `Promise<T[]>`    | Loads one ore more entities                 |
| `clear`     | key: `string` | `Promise<this>`   | Clear one entity by key                    |
| `clearMany` | keys: `string[]` | `Promise<this>`   | Clear one ore more entities                |
| `clearAll`  | - | `Promise<this>`   | Clear all entities                         |
| `prime`     | value: `T`, [expires: `string \| number`] | `Promise<this>`   | Put data to dataloader cache               |
| `primeMany` | values: `T[]`, [expires: `string \| number`] | `Promise<this>`   | Put more then one data to dataloader cache |
