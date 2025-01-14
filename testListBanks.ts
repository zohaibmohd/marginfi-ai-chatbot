import { listBanksManual } from "./marginfiActions";

async function main() {
  await listBanksManual();
}

main().catch(console.error);