# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript + copy SVG/JSON assets to dist/
npm run dev          # Watch mode (TypeScript only, no assets)
npm run lint         # ESLint check
npm run lintfix      # ESLint auto-fix
npm run format       # Prettier format (nodes + credentials)
```

`npm run build` runs `tsc` then `gulp build:icons` (copies `.svg` and `.node.json` files to `dist/nodes`). Both steps are required — the compiled JS won't work without the icon/metadata assets.

There are no automated tests.

## Architecture

This is an **n8n community node package** that integrates the [Passbolt](https://www.passbolt.com/) password manager API into n8n workflows.

### Entry points

- `credentials/PassboltApi.credentials.ts` — declares the `passboltApi` credential type (serverUrl, userId, privateKey, passphrase)
- `nodes/Passbolt/Passbolt.node.ts` — the single n8n node, handles all resources/operations
- `nodes/Passbolt/GenericFunctions.ts` — all GPG crypto and HTTP logic

### GPG authentication flow

Passbolt uses end-to-end GPG encryption with JWT auth. `GenericFunctions.ts` implements:

1. **Challenge-response auth** (`authenticate`): builds a JSON challenge, encrypts it with the server's public key (signed with user's private key), POSTs to `/auth/jwt/login.json`, decrypts the server's response to extract JWT tokens, verifies the `verify_token` matches to prevent MITM.
2. **Token caching**: an in-process `Map<string, TokenCache>` keyed by `serverUrl::userId` caches JWT tokens and tries refresh before full re-auth.
3. **Secret encryption**: secrets are stored as JSON `{ password, description }` encrypted with OpenPGP. `encryptSecretForSelf` derives the public key from the user's private key. `encryptSecretForUser` fetches the recipient's armored public key from the API.

### Node structure

`Passbolt.node.ts` routes by `resource` + `operation` to handler functions. The five resource types (Resource/Password, Folder, User, Group, Share) each have a corresponding description file in `nodes/Passbolt/descriptions/` that exports `*Operations` and `*Fields` arrays for the n8n UI.

The `passboltApiRequest` helper in `GenericFunctions.ts` handles credential retrieval, GPG key decryption, token acquisition, and HTTP via `this.helpers.request`. `passboltApiRequestAllItems` paginates using `page` + `limit=100` query params.

### Share operation

Sharing a resource requires decrypting the secret first, then re-encrypting it with each recipient's public key (fetched from the API). For group sharing, this means one API call per group member.

### Build output

TypeScript compiles to `dist/` (CommonJS, ES2020 target). The gulp step copies `.svg` and `.node.json` files into `dist/nodes/`. The `n8n` key in `package.json` points n8n to `dist/credentials/PassboltApi.credentials.js` and `dist/nodes/Passbolt/Passbolt.node.js`.
