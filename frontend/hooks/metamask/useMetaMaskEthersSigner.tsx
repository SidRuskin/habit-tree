"use client";

import { useMemo, useState, useEffect } from "react";
import { ethers } from "ethers";
import { useMetaMaskProvider } from "./useMetaMaskProvider";

export function useMetaMaskEthersSigner() {
  const { provider, chainId, accounts, isConnected, connect } = useMetaMaskProvider();
  const [ethersSigner, setEthersSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);

  useEffect(() => {
    if (!provider || !accounts[0]) {
      setEthersSigner(undefined);
      return;
    }
    const ethersProvider = new ethers.BrowserProvider(provider);
    ethersProvider.getSigner().then((signer) => {
      setEthersSigner(signer);
    }).catch(() => {
      setEthersSigner(undefined);
    });
  }, [provider, accounts]);

  const ethersReadonlyProvider = useMemo(() => {
    if (!provider) return undefined;
    return new ethers.BrowserProvider(provider);
  }, [provider]);

  return {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain: { current: (id: number | undefined) => id === chainId },
    sameSigner: { current: (signer: any) => signer !== undefined },
    initialMockChains: { 31337: "http://localhost:8545" },
  };
}

