import { gatherBankAnalytics } from "./marginfiAnalytics";

(async () => {
  try {
    const analytics = await gatherBankAnalytics();
    console.log("---- Marginfi Analytics ----");
    console.log(JSON.stringify(analytics, null, 2));
  } catch (error) {
    console.error("Error running analytics:", error);
  }
})();