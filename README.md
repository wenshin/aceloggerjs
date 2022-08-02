# AceLogger mono repo

# Development

## Link to local repo

```
$> cd packages/package
$> pnpm link --global
$> cd /path/to/project && pnpm link --global pkg-name
```

## Run tests

```
pnpm test --filter "acelogger*"
```

# Publish

```
$> pnpm changeset
$> pnpm changeset version
$> pnpm publish --registry=https://registry.npmjs.org --filter "acelogger\*"
```
