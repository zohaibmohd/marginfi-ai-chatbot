/***************************************************
 * offlineMainnetFetch.ts
 *
 * PURPOSE:
 *   1) Load "prefetched_config_mainnet.json" from disk
 *   2) Reconstruct MarginfiGroup + Bank objects offline
 *   3) Provide a function createOfflineMainnetOverride(...)
 *      that returns a fetchGroupDataOverride for MarginfiClient.
 ***************************************************/

import fs from "fs";
import { PublicKey } from "@solana/web3.js";
import {
  MarginfiGroup,
  Bank
} from "@mrgnlabs/marginfi-client-v2";
// ^ If needed, adjust the import path or version

/**
 * Matches the JSON format we wrote in prefetchMainnet.ts
 */
interface BankRecord {
  address: string;            // base58
  data: string;               // entire raw bank data in base64
  mintAddress: string;        // optional usage
  mintRaw?: string;           
  oracleAddress?: string;     
  oracleRaw?: string;
  emissionsMintAddress?: string;
  emissionsMintRaw?: string;
}

interface PrefetchedMarginfiData {
  groupConfig: {
    programId: string;  // base58 
    groupPk: string;    // base58
  };
  marginfiGroup: {
    data: string;       // raw group data, base64
  };
  banks: BankRecord[];
}

/**
 * createOfflineMainnetOverride(...)
 * 
 * We return a function that implements Marginfi's
 * "fetchGroupDataOverride" signature, so that 
 * MarginfiClient.fetch(... { fetchGroupDataOverride }) 
 * can bypass big RPC calls.
 */
export function createOfflineMainnetOverride(prefetchFilePath: string) {
  // 1) read the JSON on disk
  const raw = fs.readFileSync(prefetchFilePath, "utf8");
  const prefetched = JSON.parse(raw) as PrefetchedMarginfiData;

  // 2) return the override function
  return async function offlineMainnetFetchGroupDataOverride(
    program: any,             // anchor Program
    groupPk: PublicKey,       // marginfi group pk
    _commitment: string,      
    _preloadedBankAddresses?: PublicKey[],
    _bankMetadataMap?: any
  ) {
    // A) Rebuild the MarginfiGroup
    const groupBuf = Buffer.from(prefetched.marginfiGroup.data, "base64");
    // The official marginfi-client-v2 often has: 
    //   MarginfiGroup.fromBuffer(groupPk, rawData, program.idl, feedIdMap)
    // check your installed version for the exact signature
    const marginfiGroup = MarginfiGroup.fromBuffer(
      groupPk,
      groupBuf,
      program.idl,
      new Map() // empty feedIdMap or we can skip 
    );

    // B) Rebuild Banks
    const banks = new Map<string, Bank>();

    for (const b of prefetched.banks) {
      const bankPk = new PublicKey(b.address);

      // convert the raw base64 to a buffer
      const bankBuf = Buffer.from(b.data, "base64");

      // we create a minimal "dummy" AccountInfo object 
      const dummyInfo = {
        data: bankBuf,
        executable: false,
        lamports: 0, 
        owner: new PublicKey(prefetched.groupConfig.programId),
        rentEpoch: 0,
      };

      // fromBuffer => reconstruct a Bank
      const bank = Bank.fromBuffer(
        bankPk,
        dummyInfo,
        marginfiGroup,
        new Map(), // feedIdMap if you have one
        []
      );

      banks.set(b.address, bank);
    }

    // C) Return structure matching normal fetchGroupData
    return {
      marginfiGroup,
      banks,
      priceInfos: [],   // optional
      tokenDatas: [],   // optional
      feedIdMap: {},    // optional
    };
  };
}