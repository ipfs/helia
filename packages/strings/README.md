<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/strings <!-- omit in toc -->

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia-strings.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia-strings)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia-strings/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia-strings/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> Add/get IPLD blocks containing strings with your Helia node

# About

`@helia/strings` makes working with strings Helia simple & straightforward.

See the Strings interface for all available operations.

## Example

```typescript
import { createHelia } from 'helia'
import { strings } from '@helia/strings'
import { CID } from 'multiformats/cid'

const str = strings(helia)
const cid = await str.put('hello world')
const string = await str.get(cid)

console.info(string)
// hello world
```
