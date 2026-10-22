import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync, realpathSync } from 'node:fs';

export function verifySecurityPatches(root, packages) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const patterns = Array.isArray(manifest.workspaces) ? manifest.workspaces : manifest.workspaces?.packages ?? [];
  const manifests = new Set([resolve(root, 'package.json'), resolve(root, 'node_modules/.bun/node_modules/package.json')]);
  for (const pattern of patterns) {
    for (const file of new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: root, onlyFiles: true })) manifests.add(resolve(root, file));
  }
  for (const name of packages) {
    const entries = new Set();
    for (const file of manifests) {
      try { entries.add(realpathSync(createRequire(file).resolve(name))); } catch {}
    }
    if (!entries.size) throw new Error(`Patched dependency ${name} is not installed in any workspace`);
    for (const entry of entries) {
      const require = createRequire(resolve(root, 'package.json'));
      if (name === 'braces') {
        const braces = require(entry);
        assert.deepEqual(braces.expand('item-{1..3}'), ['item-1', 'item-2', 'item-3']);
        const limited = (error) => error instanceof RangeError && error.message === 'Maximum brace nesting depth exceeded';
        assert.throws(() => braces.parse('{'.repeat(4000) + 'x' + '}'.repeat(4000)), limited);
        for (const method of ['compile', 'expand', 'stringify']) {
          let node = { type: 'text', value: 'x' };
          for (let i = 0; i < 300; i++) node = { type: 'brace', open: true, close: true, commas: 1, ranges: 0, nodes: [node] };
          const ast = { type: 'root', nodes: [node] };
          assert.throws(() => braces[method](ast), limited);
        }
      } else if (name === 'node-forge') {
        const forge = require(entry);
        const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
        const md = forge.md.sha256.create().update('Synthetic dependency regression');
        const digest = md.digest().getBytes();
        assert.equal(keys.publicKey.verify(digest, keys.privateKey.sign(md)), true);
        const { asn1 } = forge;
        const element = (type, value, constructed = false) => asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
        for (const withNull of [true, false]) {
          const algorithm = [element(asn1.Type.OID, asn1.oidToDer(forge.oids.sha256).getBytes())];
          if (withNull) algorithm.push(element(asn1.Type.NULL, ''));
          algorithm.push(element(asn1.Type.OCTETSTRING, 'unexpected'));
          const info = element(asn1.Type.SEQUENCE, [element(asn1.Type.SEQUENCE, algorithm, true), element(asn1.Type.OCTETSTRING, digest)], true);
          const der = asn1.toDer(info).getBytes();
          const blockLength = Math.ceil(keys.publicKey.n.bitLength() / 8);
          const block = '\x00\x01' + '\xff'.repeat(blockLength - der.length - 3) + '\x00' + der;
          const signature = forge.pki.rsa.encrypt(block, keys.privateKey, false);
          assert.throws(() => keys.publicKey.verify(digest, signature), /DigestInfo/);
        }
      } else {
        throw new Error(`No security regression is registered for ${name}`);
      }
    }
  }
}
