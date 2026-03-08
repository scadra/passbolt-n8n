# n8n-nodes-passbolt

An [n8n](https://n8n.io/) community node for [Passbolt](https://www.passbolt.com/) — the open-source password manager for teams.

This node provides full CRUD operations for Passbolt resources (passwords), folders, users, groups, and sharing — with automatic GPG encryption/decryption of secrets.

## Requirements

- n8n >= 1.36.0
- Node.js >= 22.x

> **Note:** This node uses `openpgp` as a runtime dependency for GPG encryption.
> It cannot be submitted for n8n Cloud verification (which requires zero runtime dependencies).
> It is available as a self-hosted community node only.

## Installation

### Community Node (Recommended)

1. Open your n8n instance
2. Go to **Settings > Community Nodes**
3. Select **Install a community node**
4. Enter `n8n-nodes-passbolt`
5. Confirm the installation

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-passbolt
```

Then restart n8n.

## Credentials

You need the following from your Passbolt instance:

| Field | Description |
|-------|-------------|
| **Server URL** | Base URL of your Passbolt instance (e.g. `https://passbolt.example.com`) |
| **User ID** | Your Passbolt user UUID (found in your profile) |
| **Private Key** | Your OpenPGP private key in armored format |
| **Passphrase** | The passphrase that protects your private key |

### How to export your private key

From the Passbolt browser extension:
1. Click your avatar > **Profile**
2. Go to **Keys Inspector**
3. Copy or export your private key

Or use the CLI:
```bash
gpg --armor --export-secret-keys your@email.com
```

## Supported Operations

### Resource (Password)
- **Create** — Create a new password entry (auto-encrypted)
- **Get** — Retrieve a password entry (auto-decrypted)
- **Get Many** — List password entries (all secrets auto-decrypted)
- **Update** — Update a password entry (auto re-encrypted)
- **Delete** — Delete a password entry

### Folder
- **Create** — Create a new folder
- **Get** — Retrieve a folder
- **Get Many** — List folders
- **Update** — Update a folder (rename / move)
- **Delete** — Delete a folder

### User
- **Get** — Retrieve a user's details
- **Get Many** — List users with optional filters

### Group
- **Get** — Retrieve a group's details
- **Get Many** — List groups with optional filters

### Share
- **Share Resource** — Share a password with a user or group (re-encrypts the secret for each recipient)

## How It Works

Passbolt uses end-to-end GPG encryption. This node handles the full authentication and encryption flow:

1. **Authentication**: GPG challenge-response + JWT token exchange
2. **Creating secrets**: Encrypts with your public key before sending to the server
3. **Reading secrets**: Fetches encrypted data from the server and decrypts with your private key
4. **Sharing**: Decrypts the secret, then re-encrypts it with each recipient's public key

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Lint
npm run lint
```

## License

MIT
