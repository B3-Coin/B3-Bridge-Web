# Peer hosting with IPFS

The production build in `dist/client` is a complete static website. It needs no web server code, database, B3 RPC credentials, or wallet secrets.

## Build and add it to a local IPFS node

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
ipfs add --cid-version=1 --raw-leaves --recursive dist/client
```

The CID on the final output line represents the complete website. Pin that CID on several independently operated IPFS nodes:

```sh
ipfs pin add /ipfs/YOUR_CID
```

With Kubo's local gateway running, open:

```text
http://YOUR_CID.ipfs.localhost:8080/
```

For a public gateway, use the gateway's **CID subdomain** form. The site intentionally uses root-relative assets, so path-style `/ipfs/CID/` gateway URLs are not supported.

Before sharing a new CID, compare the vault address shown by the page with `public/deployment.json` and confirm that the repository commit passed its Checks workflow.

Every GitHub build also creates the same kind of CAR file and records its root CID. It deliberately does not pin automatically until independent operators configure their own Kubo, IPFS Cluster, or pinning-service credentials.
