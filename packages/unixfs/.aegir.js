import EchoServer from "aegir/echo-server";
import { format } from "iso-url";

export default {
  test: {
    async before(options) {
      let echoServer = new EchoServer();
      await echoServer.start();
      const { address, port } = echoServer.server.address();
      let hostname = address;
      if (options.runner === "react-native-android") {
        hostname = "10.0.2.2";
      }
      return {
        echoServer,
        env: { ECHO_SERVER: format({ protocol: "http:", hostname, port }) },
      };
    },
    async after(options, before) {
      await before.echoServer.stop();
    },
  },
};
