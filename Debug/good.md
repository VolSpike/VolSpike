2025-11-21T20:00:41.989314998Z [inf]  
2025-11-21T20:00:43.908578776Z [inf]  [35m[Region: us-east4][0m
2025-11-21T20:00:43.912152764Z [inf]  [35m=========================
2025-11-21T20:00:43.912181715Z [inf]  Using Detected Dockerfile
2025-11-21T20:00:43.912185365Z [inf]  =========================
2025-11-21T20:00:43.912188614Z [inf]  [0m
2025-11-21T20:00:43.912202950Z [inf]  context: w5md-4qjj
2025-11-21T20:00:44.082421913Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:00:44.082485922Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:00:44.082515970Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:00:44.107738526Z [inf]  [internal] load build definition from Dockerfile
2025-11-21T20:00:44.111730561Z [inf]  [internal] load metadata for docker.io/library/node:18-alpine
2025-11-21T20:00:44.219066259Z [inf]  [internal] load metadata for docker.io/library/node:18-alpine
2025-11-21T20:00:44.219347327Z [inf]  [internal] load .dockerignore
2025-11-21T20:00:44.219399274Z [inf]  [internal] load .dockerignore
2025-11-21T20:00:44.219420460Z [inf]  [internal] load .dockerignore
2025-11-21T20:00:44.237560396Z [inf]  [internal] load .dockerignore
2025-11-21T20:00:44.244028676Z [inf]  [8/8] RUN npm prune --omit=dev
2025-11-21T20:00:44.244058304Z [inf]  [7/8] RUN npm run build
2025-11-21T20:00:44.244071408Z [inf]  [6/8] RUN npx prisma generate
2025-11-21T20:00:44.244081479Z [inf]  [5/8] COPY . .
2025-11-21T20:00:44.244090001Z [inf]  [4/8] RUN npm install
2025-11-21T20:00:44.244095803Z [inf]  [3/8] COPY package*.json ./
2025-11-21T20:00:44.244102180Z [inf]  [internal] load build context
2025-11-21T20:00:44.244116209Z [inf]  [2/8] WORKDIR /app
2025-11-21T20:00:44.244122228Z [inf]  [1/8] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e
2025-11-21T20:00:44.244140763Z [inf]  [1/8] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e
2025-11-21T20:00:44.244146980Z [inf]  [internal] load build context
2025-11-21T20:00:44.244160135Z [inf]  [internal] load build context
2025-11-21T20:00:44.250996394Z [inf]  [1/8] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e
2025-11-21T20:00:44.251320146Z [inf]  [internal] load build context
2025-11-21T20:00:44.300879777Z [inf]  [internal] load build context
2025-11-21T20:00:44.304957972Z [inf]  [2/8] WORKDIR /app
2025-11-21T20:00:44.304993966Z [inf]  [3/8] COPY package*.json ./
2025-11-21T20:00:44.305022506Z [inf]  [4/8] RUN npm install
2025-11-21T20:00:44.305036306Z [inf]  [5/8] COPY . .
2025-11-21T20:00:44.351846880Z [inf]  [5/8] COPY . .
2025-11-21T20:00:44.355932717Z [inf]  [6/8] RUN npx prisma generate
2025-11-21T20:00:46.321700492Z [inf]  Prisma schema loaded from prisma/schema.prisma

2025-11-21T20:00:46.821309859Z [inf]  
✔ Generated Prisma Client (v6.18.0) to ./node_modules/@prisma/client in 211ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints


2025-11-21T20:00:46.886120936Z [inf]  [6/8] RUN npx prisma generate
2025-11-21T20:00:46.890245164Z [inf]  [7/8] RUN npm run build
2025-11-21T20:00:47.121618599Z [inf]  
> volspike-backend@1.0.0 build
> tsc


2025-11-21T20:01:06.178239434Z [inf]  [7/8] RUN npm run build
2025-11-21T20:01:06.182383991Z [inf]  [8/8] RUN npm prune --omit=dev
2025-11-21T20:01:07.043504082Z [inf]  npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'next@16.0.1',
npm warn EBADENGINE   required: { node: '>=20.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }

2025-11-21T20:01:07.044990055Z [inf]  npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'vite@7.2.2',
npm warn EBADENGINE   required: { node: '^20.19.0 || >=22.12.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }

2025-11-21T20:01:07.045595444Z [inf]  npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'vitest@4.0.10',
npm warn EBADENGINE   required: { node: '^20.0.0 || ^22.0.0 || >=24.0.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }

2025-11-21T20:01:08.356608744Z [inf]  
up to date, audited 282 packages in 2s

2025-11-21T20:01:08.356629339Z [inf]  
55 packages are looking for funding
  run `npm fund` for details

2025-11-21T20:01:08.357862902Z [inf]  
found 0 vulnerabilities

2025-11-21T20:01:09.171624395Z [inf]  [8/8] RUN npm prune --omit=dev
2025-11-21T20:01:10.069381670Z [inf]  [auth] sharing credentials for production-us-east4-eqdc4a.railway-registry.com
2025-11-21T20:01:10.069442474Z [inf]  [auth] sharing credentials for production-us-east4-eqdc4a.railway-registry.com
2025-11-21T20:01:12.959348880Z [inf]  importing to docker
2025-11-21T20:01:31.961955742Z [inf]  importing to docker
2025-11-21T20:01:32.080128583Z [inf]  [92mBuild time: 48.17 seconds[0m