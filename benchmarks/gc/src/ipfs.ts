const os = require('os');
const path = require('path');
const { create } = require('ipfs-core');
const all = require('it-all');
const drain = require('it-drain');
const { GcBenchmark } = require('./index.js');

export async function createIpfsBenchmark () {
  try {
    const repoPath = path.join(os.tmpdir(), `ipfs-${Math.random()}`);

    const ipfs = await create({
      config: {
        Addresses: {
          Swarm: []
        }
      },
      repo: repoPath,
      start: false,
      init: {
        emptyRepo: true
      }
    });

    return {
      async gc () {
        try {
          await drain(ipfs.repo.gc());
        } catch (error) {
          console.error('Error in gc:', error);
        }
      },
      async putBlocks (blocks) {
        for (const { value } of blocks) {
          try {
            await ipfs.block.put(value);
          } catch (error) {
            console.error('Error in putBlocks:', error);
          }
        }
      },
      async pin (cid) {
        try {
          await ipfs.pin.add(cid);
        } catch (error) {
          console.error('Error in pin:', error);
        }
      },
      async teardown () {
        try {
          await ipfs.stop();
        } catch (error) {
          console.error('Error in teardown:', error);
        }
      },
      async clearPins () {
        try {
          const pins = await all(ipfs.pin.ls());

          for (const pin of pins) {
            if (pin.type !== 'recursive' && pin.type !== 'direct') {
              continue;
            }

            await ipfs.pin.rm(pin.cid);
          }

          return pins.length;
        } catch (error) {
          console.error('Error in clearPins:', error);
        }
      },
      isPinned: async (cid) => {
        try {
          const result = await all(ipfs.pin.ls({
            paths: cid
          }));

          return result[0].type.includes('direct') || result[0].type.includes('indirect') || result[0].type.includes('recursive');
        } catch (error) {
          console.error('Error in isPinned:', error);
          return false; // Return false if an error occurs
        }
      },
      hasBlock: async (cid) => {
        try {
          await ipfs.block.get(cid);
          return true;
        } catch (error) {
          console.error('Error in hasBlock:', error);
          return false;
        }
      }
    };
  } catch (error) {
    console.error('Error in createIpfsBenchmark:', error);
    throw error; // Rethrow the error to handle it at a higher level
  }
}
