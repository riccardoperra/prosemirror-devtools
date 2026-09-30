# Changesets

Each user-facing change to a published package should include a changeset:

```sh
pnpm changeset
```

Choose the affected package, select the appropriate semantic version bump, and
write a concise release note. The framework examples and shared demo kit are private and excluded
from releases.

## Publishing to npm

Only `packages/prosemirror-devtools` is published. The workspace root, framework examples,
and shared demo kit have `private: true`. The npm package includes the built `dist` directory,
package README, changelog, and license.

Configure the repository's `NPM_TOKEN` GitHub Actions secret with an npm token authorized to
publish `prosemirror-inspector`. GitHub Actions must also be allowed to create pull requests
in the repository settings.

After a changeset is merged into `main`, the Release workflow opens or updates a version PR.
Merge that PR to publish the new version to npm and create its GitHub release. The workflow
builds, tests, and validates only the library; it does not build or publish the examples.
It can also be started manually on `main` through GitHub Actions.

To prepare a release locally, run `pnpm version-packages` and commit the resulting version
and changelog changes. With npm authentication configured, run `pnpm release` to build,
validate, and publish unpublished versions, then push the generated tags with
`git push --follow-tags`.

To inspect the package without publishing:

```sh
pnpm build:package
pnpm --filter prosemirror-inspector run publint
pnpm --filter prosemirror-inspector pack --pack-destination /tmp/prosemirror-inspector-pack
```
