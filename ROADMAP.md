# Roadmap <!-- omit in toc -->

This project is creating a focused, modular, opinionated, JavaScript-native implementation of [IPFS](https://ipfs.tech/) (the Interplanetary File System).

Our goal is a high-quality implementation of the IPFS protocol in TypeScript/JavaScript. It shall run in web browsers, in service workers, in browser extensions, in Node.js, and virtually everywhere else JS runs.

```
Created: 2022-10-26
Updated: 2022-01-10
Status: Draft
Notes: Maintainers have aligned on this roadmap. Please add any feedback or questions in:
https://github.com/ipfs/helia/issues/5
```

## Table of Contents <!-- omit in toc -->

- [🛣️ Milestones](#️-milestones)
  - [2023](#2023)
    - [Early Q1 (January)](#early-q1-january)
      - [Finalize Execution Plan](#finalize-execution-plan)
    - [Late Q1 (March)](#late-q1-march)
      - ["v1" Released](#v1-released)
    - [Q2](#q2)
      - [Drive Adoption](#drive-adoption)
    - [Q3](#q3)
      - [Support Fully Speced Delegated Routing Protocols and Endpoints](#support-fully-speced-delegated-routing-protocols-and-endpoints)
      - [PL Delegate and Preload Nodes Will Be Shutting Down](#pl-delegate-and-preload-nodes-will-be-shutting-down)
- Past Milestones
  - [2022](#2022)
    - [Mid Q4 (November)](#mid-q4-november)
      - [Communicate the State of IPFS in JS](#communicate-the-state-of-ipfs-in-js)
    - [Late Q4 (December)](#late-q4-december)
      - [Double Team Capacity](#double-team-capacity)

# 🛣️ Milestones

## 2023

### Early Q1 (January)

#### Finalize Execution Plan

- Project scope, milestones, success criteria, and communication channels are established.
- Community can follow along and contribute.

### Late Q1 (March)

#### "v1" Released

- Users can add and get files.
- Packaging, publishing, testing, CI/CD, etc. are all set up.

Tracking issue: https://github.com/ipfs/helia/issues/2

### Q2

#### Drive Adoption

After Helia is functional and users can adopt it, Protocol Labs EngRes ceases maintaining the legacy js-ipfs project.

### Q3

#### Support Fully Speced Delegated Routing Protocols and Endpoints

While it will be possible from a connectivity perspective to make DHT queries from a browser, we expect various applications will want to still delegate out routing. [Reframe](https://blog.ipfs.tech/2022-09-02-introducing-reframe/) is a protocol for delegated routing that other IPFS implementations like Kubo have implemented. While it currently uses HTTP as a transport, it is speced and not tied to the Kubo RPC API. If/when there is a speced protocol for ambient discovery of “Limited Delegated Routers” provided by libp2p, we will support that as well.

#### PL Delegate and Preload Nodes Will Be Shutting Down

Given new browser-friendly p2p transports, we’ll shut down the complicated “song-and-dance” with the legacy delegate/preload nodes. This yields a simpler setup for one’s application and removes centralized infrastructure.

For delegated routing, one can configure [Reframe](https://blog.ipfs.tech/2022-09-02-introducing-reframe/) endpoints. When it comes to providing content from a browser node, it will be up to developers to account for user behavior like closing tabs or laptop lids. The general recommendation is to either run your own preload node or upload content explicitly to a pinning service for providing.

# Past Milestones

## 2022

### Mid Q4 (November)

#### Communicate the State of IPFS in JS

**Problem to solve:** Currently, very few know the direction for IPFS-in-JS and how they can best help. This affects project resourcing, recruiting, and IPFS adoption in general.

**Done state:**
- Present and share the IPFS Camp 2022 presentation. (Done: [State of IPFS in JS](https://www.youtube.com/watch?v=4BPah-xItxA), [slides](https://github.com/achingbrain/state-of-ipfs-in-js-2022-talk))
- Write and publish a blog post. (Done: [State of IPFS in JS](https://blog.ipfs.tech/state-of-ipfs-in-js/))
- Hold a community vote and communication about a name for the new IPFS-in-JS implementation. (Done: [Name](https://github.com/ipfs/helia#name))

### Late Q4 (December)

#### Double Team Capacity

**Problem to solve:** Currently, the IPFS-in-JS effort has less than one full-time SWE (Software Engineer) who is also splitting time with js-libp2p.

**Done state:** Accepted offer for 1-2 additional full-time engineers.

**Why:** Extra hands are needed for designing, planning, and executing on IPFS-in-JS. Even if we outsource development, help is needed to review and guide the development work.

Tracking issue: https://github.com/ipfs/pomegranate/issues/6
