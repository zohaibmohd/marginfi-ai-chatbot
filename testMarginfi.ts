import { initializeMarginfi } from "./marginfiActions";

async function main() {
  const { client, marginfiAccount } = await initializeMarginfi();
  console.log("Marginfi setup complete!");
}

main().catch(console.error);