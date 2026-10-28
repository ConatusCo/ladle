#!/bin/bash

set -eo pipefail

echo "Running release for @conatusco/ladle"

echo "Build @conatusco/ladle"
turbo run build --filter=@conatusco/ladle

echo "Update package.json"
node ./packages/ladle/scripts/update-package-types.js

echo "Generate Types"
pnpm --filter @conatusco/ladle types

echo "Publishing to GitHub Packages"
npm publish ./packages/ladle --registry=https://npm.pkg.github.com

echo "Revert package.json"
node ./packages/ladle/scripts/revert-package-types.js
