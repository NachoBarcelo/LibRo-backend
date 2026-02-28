# LibRo Backend

Backend inicial de **LibRo**, una biblioteca personal de libros, construido con:

- Node.js
- Express
- TypeScript (strict)
- Prisma ORM
- PostgreSQL (Supabase)

Está listo para desarrollo local y producción básica (Railway/Render).

## 1) Instalación

```bash
npm install
```

## 2) Variables de entorno

Crea `.env` a partir de `.env.example`:

```env
PORT=4000
DATABASE_URL="postgresql://..."
```

`DATABASE_URL` debe ser la cadena de conexión de tu proyecto en Supabase.

## 3) Prisma setup

```bash
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
```

Esto crea tablas y genera el cliente Prisma.

## 4) Desarrollo

```bash
npm run dev
```

Healthcheck:

- `GET /health`

## 5) Build y producción

```bash
npm run build
npm start
```

## 6) Endpoints

### Books

- `POST /books` → crea libro si no existe por `externalId`
- `GET /books` → lista todos los libros
- `GET /books/:id` → detalle completo de un libro local (incluye `userBooks`, `reviews` y `openLibrary` con metadata completa)
- `GET /api/books/search?query=...` → busca libros en Open Library (título/autor/isbn/texto libre)

Body `POST /books`:

```json
{
  "externalId": "google-books-123",
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "coverImage": "https://example.com/cover.jpg",
  "publishedYear": 2008
}
```

Respuesta `GET /api/books/search?query=harry+potter`:

```json
[
  {
    "title": "Harry Potter and the Philosopher's Stone",
    "author": "J. K. Rowling",
    "year": 1997,
    "isbn": "9780747532699",
    "coverUrl": "https://covers.openlibrary.org/b/isbn/9780747532699-L.jpg"
  }
]
```

Respuesta `GET /books/:id`:

```json
{
  "success": true,
  "data": {
    "id": "uuid-del-book",
    "externalId": "openlibrary:OL123M",
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "coverImage": "https://covers.openlibrary.org/b/olid/OL123M-L.jpg",
    "publishedYear": 2008,
    "createdAt": "2026-02-27T10:00:00.000Z",
    "userBooks": [
      {
        "id": "uuid-del-userbook",
        "bookId": "uuid-del-book",
        "status": "FAVORITE",
        "createdAt": "2026-02-27T10:10:00.000Z"
      }
    ],
    "reviews": [
      {
        "id": "uuid-del-review",
        "bookId": "uuid-del-book",
        "title": "Gran lectura",
        "content": "Me gustó mucho el enfoque práctico.",
        "rating": 5,
        "createdAt": "2026-02-27T10:20:00.000Z",
        "updatedAt": "2026-02-27T10:20:00.000Z"
      }
    ],
    "openLibrary": {
      "olid": "OL123M",
      "byBibkey": {
        "title": "Clean Code"
      },
      "edition": {
        "key": "/books/OL123M"
      }
    }
  }
}
```

Notas:
- `openLibrary` se llena usando el `externalId` del libro local.
- Si `externalId` no corresponde a Open Library (no contiene `OL...M`), `openLibrary` devuelve `null`.

### User Books

- `POST /user-books` → agrega/actualiza libro en lista (`FAVORITE`, `TO_READ`, `READ`)
- `GET /user-books?status=FAVORITE` → lista por estado
- `DELETE /user-books/:id` → elimina de la lista

Body `POST /user-books`:

```json
{
  "bookId": "uuid-del-book",
  "status": "TO_READ"
}
```

### Reviews

- `POST /reviews` → crea reseña
- `GET /reviews` → lista reseñas
- `GET /reviews/:id` → obtiene reseña por ID
- `GET /reviews/book/:bookId` → reseñas de un libro
- `PUT /reviews/:id` → edita reseña
- `DELETE /reviews/:id` → elimina reseña

Body `POST /reviews`:

```json
{
  "bookId": "uuid-del-book",
  "title": "Gran lectura",
  "content": "Me gustó mucho el enfoque práctico.",
  "rating": 5
}
```

## 7) Arquitectura

```txt
src/
  app.ts
  server.ts
  routes/
    book.routes.ts
    userBook.routes.ts
    review.routes.ts
  controllers/
  services/
  middlewares/
    error.middleware.ts
  lib/
    prisma.ts
```

- `routes`: define endpoints y validación
- `controllers`: orquesta request/response
- `services`: lógica de negocio + Prisma
- `middlewares`: validación y manejo global de errores

## 8) Deploy en Railway o Render

### Railway

1. Conecta el repo.
2. Define variable `DATABASE_URL` (Supabase) y opcional `PORT`.
3. Configura:
   - Build Command: `npm install && npm run prisma:generate && npm run build`
   - Start Command: `npm start`
4. Ejecuta migraciones una vez (CLI de Railway o job):
   - `npx prisma migrate deploy`

### Render

1. Crea un nuevo Web Service desde el repo.
2. Environment:
   - `DATABASE_URL`
   - `NODE_ENV=production`
3. Build Command:
   - `npm install && npm run prisma:generate && npm run build`
4. Start Command:
   - `npm start`
5. Corre migraciones en un one-off job:
   - `npx prisma migrate deploy`

## 9) Notas

- Single-user mode: no existe entidad `User` ni `userId` en requests.
- Manejo de errores global con respuestas consistentes.
- Validaciones básicas con Zod en body/query/params.
