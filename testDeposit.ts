import { depositToBank } from "./marginfiActions";

async function main() {
  await depositToBank(1); // Deposit 1 SOL
}

main().catch(console.error);