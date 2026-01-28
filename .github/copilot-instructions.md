# GitHub Copilot Instructions for TOGAPhotos Backend

## Architecture & Project Structure

This project is a TypeScript/Node.js backend using Express and Prisma.

- **Layered Architecture**: `Router` -> `Handler` (Controller) -> `DTO` (Data Access/Repository) -> `Prisma` -> `Database`.
- **Services**: `src/service/` contains infrastructure adapters (COS, Mail, MQ, Image Processing), not business logic.
- **Config**: Centralized in `src/config.ts` and `.env`.
- **Global Types**: `src/types/` defines Express extensions and HTTP codes.

## Code Conventions & Patterns

### API Handlers

- **Location**: `src/handler/**/*.ts`.
- **Signature**: `static async method(req: Request, res: Response)`.
- **Response Format**: Use the custom extensions `res.success(msg, data)` and `res.fail(status, msg)`.
- **Error Handling**: `express-async-errors` is used. Throw errors naturally; the global middleware lists `src/server.ts` handles them.
- **Auth**: Use `req.token` for authenticated user info (injected by `Token.verifyMW`).

### Data Access (DTOs)

- **Location**: `src/dto/**/*.ts`.
- **Usage**: Encapsulate all Prisma usage here. Do not use `PrismaClient` directly in Handlers.
- **Decorators**: Use `@checkNumberParams` for ID validation.
- **Views**: The schema uses database views (e.g., `full_photo_info`, `accept_photo`). Use these for reading data instead of raw tables when possible.

### Services & Infrastructure

- **Message Queue**: Use `MessageQueueProducer` from `src/service/messageQueue/producer.ts`.
- **Storage**: Use `COSStorage` (Tencent COS) via `src/service/cos/`.
- **Event Bus**: Use internal `EventBus` from `src/components/eventBus/` for in-process decoupling.
- **Jobs**: Scheduled jobs are in `src/components/schedule.ts` and `src/script/`.

### Testing

- **Framework**: Vitest.
- **Location**: `src/test/` or `*.test.ts`.
- **Command**: `npm run test` (runs with `RUNNING_ENV=DEV`).

## Development Workflow

- **Start Dev**: `npm run dev` (uses `tsx`).
- **Database**: `npm run db` pulls schema and generates client. **Run this after schema changes.**
- **Scripts**: Maintenance scripts are in `script/` (run with `tsx`).

## Specific files

- `src/server.ts`: Bootstrap and middleware setup (CORS, WAF, Auth).
- `src/exntend/response.ts`: Custom response helper implementation.
- `src/config.ts`: source of truth for configuration variables.
