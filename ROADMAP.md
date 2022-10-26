# Roadmap <!-- omit in toc -->

This project is creating a focused, modular, opinionated, JavaScript-native implementation of [IPFS](https://ipfs.tech/) (the Interplanetary File System).

Our goal is a high-quality implementation of the IPFS protocol in TypeScript/JavaScript. It shall run in web browsers, in service workers, in browser extensions, in Node.js, and virtually everywhere else JS runs.

```
Date: 2022-10-26
Status: Draft
Notes: Internal stakeholders have not yet aligned on this roadmap. Please add any feedback or questions in the PR.
```

## Table of Contents <!-- omit in toc -->

- [🛣️ Milestones](#️-milestones)
  - [2022](#2022)
    - [Mid Q4 (November)](#mid-q4-november)
    - [Late Q4 (December)](#late-q4-december)
  - [2023](#2023)
    - [Early Q1 (January)](#early-q1-january)
    - [Late Q1 (March)](#late-q1-march)
    - [Q2](#q2)

## 🛣️ Milestones
### 2022

#### Mid Q4 (November)

Communicate the IPFS-in-JS state.

**Problem to solve:** Currently, very few know the direction for IPFS-in-JS and how they can best help. This affects project resourcing, recruiting, and IPFS adoption in general.

**Done state:**
- Present and share the IPFS Camp 2022 presentation.
- Write and publish a blog post.
- Hold a community vote and communication about a name for the new IPFS-in-JS implementation.

#### Late Q4 (December)

Double team capacity.

**Problem to solve:** Currently, the IPFS-in-JS effort has less than one full-time SWE (Software Engineer) who is also splitting time with js-libp2p.

**Done state:** Accepted offer for 1-2 additional full-time engineers.

**Why:** Extra hands are needed for designing, planning, and executing on IPFS-in-JS. Even if we outsource development, help is needed to review and guide the development work.

### 2023

#### Early Q1 (January)

Finalize "Pomegranate" execution plan. ("Pomegranate" is the temporary codename for the new IPFS-in-JS implementation.)

- Project scope, milestones, success criteria, and communication channels are established.
- Community can follow along and contribute to "Pomegranate".

#### Late Q1 (March)

"Pomegranate" "v1" released.

- Users can add and get files.
- Packaging, publishing, testing, CI/CD, etc. are all set up.

Tracking issue: https://github.com/ipfs/pomegranate/issues/2

#### Q2

After "Pomegranate" is functional and users can adopt it, Protocol Labs EngRes ceases maintaining the legacy js-ipfs project.
