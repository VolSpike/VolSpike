2025-11-21T20:26:29.498072748Z [inf]  
2025-11-21T20:26:32.920278865Z [inf]  [35m[Region: us-east4][0m
2025-11-21T20:26:32.923466854Z [inf]  [35m=========================
2025-11-21T20:26:32.923495570Z [inf]  Using Detected Dockerfile
2025-11-21T20:26:32.923499226Z [inf]  =========================
2025-11-21T20:26:32.923502428Z [inf]  [0m
2025-11-21T20:26:32.923515794Z [inf]  context: fg99-p2
2025-11-21T20:26:33.076330588Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:26:33.076381980Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:26:33.076402113Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:26:33.076415716Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:26:33.083990073Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:26:33.086233597Z [inf]  [internal] load metadata for docker.io/library/node:18-alpine
2025-11-21T20:26:33.089211664Z [inf]  [auth] library/node:pull token for registry-1.docker.io
2025-11-21T20:26:33.089242759Z [inf]  [auth] library/node:pull token for registry-1.docker.io
2025-11-21T20:26:33.194364479Z [inf]  [internal] load metadata for docker.io/library/node:18-alpine
2025-11-21T20:26:33.194706018Z [inf]  [internal] load .dockerignore
2025-11-21T20:26:33.194737193Z [inf]  [internal] load .dockerignore
2025-11-21T20:26:33.194752094Z [inf]  [internal] load .dockerignore
2025-11-21T20:26:33.194770012Z [inf]  [internal] load .dockerignore
2025-11-21T20:26:33.201413049Z [inf]  [internal] load .dockerignore
2025-11-21T20:26:33.204981018Z [inf]  [8/8] RUN npm prune --omit=dev
2025-11-21T20:26:33.204997271Z [inf]  [7/8] RUN npm run build
2025-11-21T20:26:33.205006347Z [inf]  [6/8] RUN npx prisma generate
2025-11-21T20:26:33.205016873Z [inf]  [5/8] COPY . .
2025-11-21T20:26:33.205025054Z [inf]  [4/8] RUN npm install
2025-11-21T20:26:33.205031537Z [inf]  [3/8] COPY package*.json ./
2025-11-21T20:26:33.205038183Z [inf]  [internal] load build context
2025-11-21T20:26:33.205044313Z [inf]  [2/8] WORKDIR /app
2025-11-21T20:26:33.205051243Z [inf]  [1/8] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e
2025-11-21T20:26:33.205064297Z [inf]  [1/8] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e
2025-11-21T20:26:33.205071850Z [inf]  [internal] load build context
2025-11-21T20:26:33.205083175Z [inf]  [internal] load build context
2025-11-21T20:26:33.210085693Z [inf]  [1/8] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e
2025-11-21T20:26:33.210410243Z [inf]  [internal] load build context
2025-11-21T20:26:33.240042978Z [inf]  [internal] load build context
2025-11-21T20:26:33.242017423Z [inf]  [2/8] WORKDIR /app
2025-11-21T20:26:33.242034453Z [inf]  [3/8] COPY package*.json ./
2025-11-21T20:26:33.242043385Z [inf]  [4/8] RUN npm install
2025-11-21T20:26:33.242058924Z [inf]  [5/8] COPY . .
2025-11-21T20:26:33.264592334Z [inf]  [5/8] COPY . .
2025-11-21T20:26:33.266232153Z [inf]  [6/8] RUN npx prisma generate
2025-11-21T20:26:35.292007617Z [inf]  Prisma schema loaded from prisma/schema.prisma

2025-11-21T20:26:35.739982214Z [inf]  
✔ Generated Prisma Client (v6.18.0) to ./node_modules/@prisma/client in 195ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints


2025-11-21T20:26:35.784742076Z [inf]  [6/8] RUN npx prisma generate
2025-11-21T20:26:35.786387180Z [inf]  [7/8] RUN npm run build
2025-11-21T20:26:36.000927807Z [inf]  
> volspike-backend@1.0.0 build
> tsc


2025-11-21T20:26:52.917348598Z [inf]  [7/8] RUN npm run build
2025-11-21T20:26:52.925187532Z [inf]  [8/8] RUN npm prune --omit=dev
2025-11-21T20:26:53.709017898Z [inf]  npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'next@16.0.1',
npm warn EBADENGINE   required: { node: '>=20.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }

2025-11-21T20:26:53.710865184Z [inf]  npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'vite@7.2.2',
npm warn EBADENGINE   required: { node: '^20.19.0 || >=22.12.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }

2025-11-21T20:26:53.711591238Z [inf]  npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'vitest@4.0.10',
npm warn EBADENGINE   required: { node: '^20.0.0 || ^22.0.0 || >=24.0.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }

2025-11-21T20:26:54.635382597Z [inf]  
up to date, audited 282 packages in 1s

2025-11-21T20:26:54.635398069Z [inf]  

2025-11-21T20:26:54.635438707Z [inf]  55 packages are looking for funding
  run `npm fund` for details

2025-11-21T20:26:54.636861968Z [inf]  
found 0 vulnerabilities

2025-11-21T20:26:54.671264891Z [inf]  [8/8] RUN npm prune --omit=dev
2025-11-21T20:26:54.674477164Z [inf]  exporting to docker image format
2025-11-21T20:26:54.674495867Z [inf]  exporting to image
2025-11-21T20:26:55.296998064Z [inf]  [auth] sharing credentials for production-us-east4-eqdc4a.railway-registry.com
2025-11-21T20:26:55.297051640Z [inf]  [auth] sharing credentials for production-us-east4-eqdc4a.railway-registry.com
2025-11-21T20:26:57.975328461Z [inf]  importing to docker
2025-11-21T20:27:10.245738491Z [inf]  importing to docker
2025-11-21T20:27:11.371606435Z [inf]  [92mBuild time: 38.45 seconds[0m