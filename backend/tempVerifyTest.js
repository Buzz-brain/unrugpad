require("dotenv").config();

const { verifyProxyImplementation } = require("./services/verificationService");

(async () => {
  const result = await verifyProxyImplementation(
    "0x6a8845de84C16902e452c8B3De364558c3A988a9",
  );
  console.log("Result:", result);
})();