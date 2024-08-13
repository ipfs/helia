import { expect } from "aegir/chai";
import all from "it-all";
import { CID } from "multiformats";
import { httpGatewayRouting } from "../src/http-gateway-routing.js";

describe("http-gateway-routing", () => {
  it("should find providers", async () => {
    const gateway = "https://example.com";
    const routing = httpGatewayRouting({
      gateways: [gateway],
    });

    const cid = CID.parse(
      "bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae",
    );

    const providers = await all(routing.findProviders?.(cid) ?? []);

    expect(providers).to.have.lengthOf(1);
    expect(providers)
      .to.have.nested.property("[0].protocols")
      .that.includes("transport-ipfs-gateway-http");
    expect(providers[0].multiaddrs.map((ma) => ma.toString())).to.include(
      "/dns4/example.com/tcp/443/https",
    );
  });
});
