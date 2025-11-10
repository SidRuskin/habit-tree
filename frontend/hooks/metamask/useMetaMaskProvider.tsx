"use client";

import { useCallback, useEffect, useState } from "react";
import { Eip1193Provider, ethers } from "ethers";

export function useMetaMaskProvider() {
  const [provider, setProvider] = useState<Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }

    try {
      const provider = window.ethereum as Eip1193Provider;
      await provider.request({ method: "eth_requestAccounts" });
      const accounts = await provider.request({ method: "eth_accounts" }) as string[];
      const chainId = await provider.request({ method: "eth_chainId" }) as string;
      
      setProvider(provider);
      setChainId(Number.parseInt(chainId, 16));
      setAccounts(accounts);
      setIsConnected(accounts.length > 0);
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      return;
    }

    const provider = window.ethereum as Eip1193Provider;
    setProvider(provider);

    const updateAccounts = async () => {
      try {
        const accounts = await provider.request({ method: "eth_accounts" }) as string[];
        const chainId = await provider.request({ method: "eth_chainId" }) as string;
        setChainId(Number.parseInt(chainId, 16));
        setAccounts(accounts);
        setIsConnected(accounts.length > 0);
      } catch (error) {
        console.error("Failed to get accounts:", error);
      }
    };

    updateAccounts();

    const handleAccountsChanged = (accounts: string[]) => {
      setAccounts(accounts);
      setIsConnected(accounts.length > 0);
    };

    const handleChainChanged = (chainId: string) => {
      setChainId(Number.parseInt(chainId, 16));
    };

    if (provider && typeof (provider as any).on === "function") {
      (provider as any).on("accountsChanged", handleAccountsChanged);
      (provider as any).on("chainChanged", handleChainChanged);
    }

    return () => {
      if (provider && typeof (provider as any).removeListener === "function") {
        (provider as any).removeListener("accountsChanged", handleAccountsChanged);
        (provider as any).removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  return {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
  };
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

