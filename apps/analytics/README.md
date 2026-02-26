# Analytics Microservice

This microservice is responsible for collecting, aggregating, and serving KPIs
for Organizations, Teams, and Users.

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the microservice in development mode:

```bash
pnpm --filter analytics dev
```

By default the microservice runs on port `3001`.

You can override this with either:

```bash
ANALYTICS_PORT=3010 pnpm --filter analytics dev
```

or:

```bash
PORT=3010 pnpm --filter analytics dev
```

## Building the microservice

To build the microservice, run the following command:

```bash
pnpm --filter analytics build
```

## Running tests

To run the unit tests, run the following command:

```bash
pnpm --filter analytics test
```

To run the end-to-end tests, run the following command:

```bash
pnpm --filter analytics test:e2e
```
