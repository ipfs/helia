# Helia/Libp2p How To

This will discuss what is required to implement an in browser helia node using libp2p and discuss why we need each part.

## DataStore and BlockStore

The datastore is used to hold important information relating to peers and DHT records. If you do not define how you want to store it, it will use one in Memory.

Blockstore is used to hold the blocks on ipfs you want to store locally

```    
import { createLibp2p } from "libp2p";
import { MemoryDatastore } from "datastore-core";
import { MemoryBlockstore } from "blockstore-core";

const datastore = new MemoryDatastore();
const blockstore = new MemoryBlockstore();

const libp2p = await createLibp2p({
    datastore,
    ... // placeholder for remaining config
})

const heliaNode = await createHelia({
        datastore,
        blockstore,
        libp2p,
});
```

## Transports

Transports define the method in which we connect to different nodes on the network. When implementing Helia its important to know a couple things. 
1. Where Helia will be run (Browser (Firefox, Chrome, Safari), Node)
2. Which nodes likely have data you need

The first point is important since tcp is not available in browser for example. It can only be used when running in Nodejs. If you are running in browser, WebTransports are not available in Safari but it is coming to Firefox. https://caniuse.com/webtransport

Helia implements libp2p to communicate which supports the following
1. TCP (Only on Node)
2. Websockets
3. Webtransports (Limited Support)
4. WebRTC
5. UDP
6. QUIC

To use a specific transport, you just need to import it and define it in the config. Let's quickly define the Webtransport and webSockets.
```
import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";

const libp2p = await createLibp2p({
    ... // placeholder for remaining config
    transports: [webSockets(), webTransport()],
})
```

## Circuit Relay

This allows our node to relay traffic to other nodes that you may wish not to be connected directly to the public. Not really helpful in the browser but can be implemented via:

**TO BE FILLED IN**

```
import { createLibp2p } from "libp2p";
import { mplex } from "@libp2p/mplex";

const libp2p = await createLibp2p({
    ... // placeholder for remaining config
    relay: ...
})
```

## Stream Muxing

It allows multiple conversations on the same line by giving it a unique identifier.

```
import { createLibp2p } from "libp2p";
import { mplex } from "@libp2p/mplex";

const libp2p = await createLibp2p({
    ... // placeholder for remaining config
    streamMuxers: [mplex()],
})
```

## Encryption

Libp2p uses noise to encrypt the connections between peers

```
import { createLibp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";

const libp2p = await createLibp2p({
    ... // placeholder for remaining config
    connectionEncryption: [noise()],
})
```

## DHT

Libp2p is based on the Kademlia DHT. We need to give it a way to access and validate the DHT.

```
import { createLibp2p } from "libp2p";
import { kadDHT } from "@libp2p/kad-dht";
import { ipnsValidator, ipnsSelector } from "@helia/ipns";

const libp2p = await createLibp2p({
    ... // placeholder for remaining config
    dht: kadDHT({
        validators: {
            ipns: ipnsValidator,
        },
        selectors: {
            ipns: ipnsSelector,
        },
    }),
})
```

## IPNI

IPNI works alongside the DHT to improve content discoverablility and even allows content retrievability on filecoin which communicates under Graphsync, a different protocol.

```
import { createLibp2p } from "libp2p";
import { ipniContentRouting } from "@libp2p/ipni-content-routing";

const libp2p = await createLibp2p({
    ... // placeholder for remaining config
    contentRouters: [ipniContentRouting("https://cid.contact")],
})
```

## Peer Discovery

Peer discovery allows us to boostrap our node with some initial peers. Here you can add your own peers to speed up the querying time for data hosted on your own nodes.



```
import { createLibp2p } from "libp2p";

const libp2p = await createLibp2p({
    ... // placeholder for remaining config
    peerDiscovery: [
            bootstrap({
                list: [
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
                ],
            }),
        ],
})
```

## Connection Gater

Connection filters allow you to filter out certain peers to prevent connections. This might be useful since their are a wide variety of peers you might not want to communicate with. In this example, we will filter out ipv6 and local ipv4 addresses to make our node not so active and prevent unneccessary connections. When a node is started it will also have its local address as its peer. When we request peers from another peer it will return their local address which off course we cannot dial. This is the reason we do not bother and just filter out those address.


```
import { createLibp2p } from "libp2p";

const libp2p = await createLibp2p({
    ... // placeholder for remaining config
    connectionGater: {
        filterMultiaddrForPeer: async (peer, multiaddr) => {
            const multiaddrString = multiaddr.toString();
            if (
                multiaddrString.includes("/ip4/127.0.0.1") ||
                multiaddrString.includes("/ip6/")
            ) {
                return false;
            }
            return true;
        },
})
```

## Combining Everything

In the below example, we will want to load IPNS and IPFS since we will be resolving some IPNS names and fetching content as well. 

You will also want to wait a couple seconds to generate all the peers and establish connection to network before trying to access content
```

import { createLibp2p } from "libp2p";
import { createHelia } from "helia";
import { noise } from "@chainsafe/libp2p-noise";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { bootstrap } from "@libp2p/bootstrap";
import { mplex } from "@libp2p/mplex";
import { MemoryDatastore } from "datastore-core";
import { MemoryBlockstore } from "blockstore-core";
import { unixfs } from "@helia/unixfs";
import { kadDHT } from "@libp2p/kad-dht";
import { ipniContentRouting } from "@libp2p/ipni-content-routing";
import { ipns, ipnsValidator, ipnsSelector } from "@helia/ipns";
import { dht } from "@helia/ipns/routing";

export const createHeliaClient = async () => {
    const blockstore = new MemoryBlockstore();
    const datastore = new MemoryDatastore();

    // Create our libp2p node
    const libp2p = await createLibp2p({
        datastore,

        // Filter out the private network addresses
        connectionGater: {
            filterMultiaddrForPeer: async (peer, multiaddr) => {
                const multiaddrString = multiaddr.toString();
                if (
                    multiaddrString.includes("/ip4/127.0.0.1") ||
                    multiaddrString.includes("/ip6/")
                ) {
                    return false;
                }
                return true;
            },
        contentRouters: [ipniContentRouting("https://cid.contact")],
        dht: kadDHT({
            validators: {
                ipns: ipnsValidator,
            },
            selectors: {
                ipns: ipnsSelector,
            },
        }),
        transports: [webSockets(), webTransport()],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        peerDiscovery: [
            bootstrap({
                list: [
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
                ],
            }),
        ],
    });
    // Listen for new peers
    libp2p.addEventListener("peer:discovery", (evt) => {
        const peer = evt.detail;
        // dial them when we discover them
        libp2p.dial(peer.id).catch((err) => {
            console.log(`Could not dial ${peer.id}`, err);
        });
    });
    // Listen for new connections to peers
    libp2p.addEventListener("peer:connect", (evt) => {
        const connection = evt.detail;
        console.log(`Connected to ${connection.remotePeer.toString()}`);
    });
    // Listen for peers disconnecting
    libp2p.addEventListener("peer:disconnect", (evt) => {
        const connection = evt.detail;
        console.log(`Disconnected from ${connection.remotePeer.toString()}`);
    });
    const heliaNode = await createHelia({
        datastore,
        blockstore,
        libp2p,
    });
    const heliaIPNS = ipns(heliaNode, [dht(heliaNode)]);
    const heliaUnixFX = unixfs(heliaNode);
    return { heliaUnixFX, heliaIPNS };
};
```

More Information can be found here https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md