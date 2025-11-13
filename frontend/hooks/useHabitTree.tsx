"use client";

import { ethers } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import HabitTreeABI from "@/abi/HabitTree.json";

export function useHabitTree({
  instance,
  fhevmDecryptionSignatureStorage,
  contractAddress,
  ethersSigner,
  ethersReadonlyProvider,
}: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  contractAddress: `0x${string}` | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
}) {
  const [habits, setHabits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<{ timestamp: number; value: bigint }[]>(
    []
  );
  const [achievements, setAchievements] = useState<
    {
      id: number;
      name: string;
      description: string;
      threshold?: bigint | number;
      metric?: string;
      isUnlocked: boolean;
      unlockedAt: number;
      isMinted?: boolean;
    }[]
  >([]);
  const [customBadges, setCustomBadges] = useState<
    {
      id: number;
      name: string;
      description: string;
      metric: "total" | "streak" | "average" | "recordCount";
      operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
      threshold: number;
      isUnlocked: boolean;
      unlockedAt: number;
      isMinted: boolean;
    }[]
  >([]);

  const contract = useMemo(() => {
    if (!contractAddress || !ethersReadonlyProvider) return null;
    return new ethers.Contract(contractAddress, HabitTreeABI, ethersReadonlyProvider);
  }, [contractAddress, ethersReadonlyProvider]);

  const contractWithSigner = useMemo(() => {
    if (!contractAddress || !ethersSigner) return null;
    return new ethers.Contract(contractAddress, HabitTreeABI, ethersSigner);
  }, [contractAddress, ethersSigner]);

  const loadHabits = useCallback(async () => {
    if (!contract || !ethersSigner) return;

    try {
      const address = await ethersSigner.getAddress();
      const count = await contract.habitCount(address);
      const habitList = [];

      for (let i = 0; i < Number(count); i++) {
        // getHabit depends on msg.sender in the contract; pass { from } override
        const habit = await contract.getHabit(i, { from: address });
        // Skip slots that have been deleted on-chain. A deleted habit slot will have:
        // isActive=false, isArchived=false, and empty name/category.
        const isDeletedSlot =
          !Boolean(habit.isActive) &&
          !Boolean(habit.isArchived) &&
          (!habit.name || (habit.name as string).length === 0);
        if (isDeletedSlot) {
          continue;
        }
        habitList.push({
          id: Number(habit.id),
          name: habit.name,
          category: habit.category,
          isActive: habit.isActive,
          isArchived: habit.isArchived,
          createdAt: Number(habit.createdAt),
        });
      }

      setHabits(habitList);
    } catch (error) {
      console.error("Failed to load habits:", error);
      setMessage("Failed to load habits");
    }
  }, [contract, ethersSigner]);

  const createHabit = useCallback(async (name: string, category: string) => {
    if (!contractWithSigner) {
      setMessage("Contract not available");
      return;
    }

    try {
      setIsLoading(true);
      const tx = await contractWithSigner.createHabit(name, category);
      await tx.wait();
      setMessage("Habit created successfully!");
      await loadHabits();
    } catch (error) {
      console.error("Failed to create habit:", error);
      setMessage("Failed to create habit");
    } finally {
      setIsLoading(false);
    }
  }, [contractWithSigner, loadHabits]);

  const submitProgress = useCallback(async (habitId: number, progress: number) => {
    if (!contractWithSigner || !instance || !ethersSigner) {
      setMessage("Not ready");
      return;
    }

    try {
      setIsLoading(true);
      const address = await ethersSigner.getAddress();
      const input = instance.createEncryptedInput(contractAddress!, address);
      input.add32(progress);
      const enc = await input.encrypt();

      const tx = await contractWithSigner.submitProgress(
        habitId,
        enc.handles[0],
        enc.inputProof
      );
      await tx.wait();
      setMessage("Progress submitted successfully!");
    } catch (error) {
      console.error("Failed to submit progress:", error);
      setMessage("Failed to submit progress");
    } finally {
      setIsLoading(false);
    }
  }, [contractWithSigner, instance, ethersSigner, contractAddress]);

  const archiveHabit = useCallback(async (habitId: number) => {
    if (!contractWithSigner) {
      setMessage("Contract not available");
      return;
    }
    try {
      setIsLoading(true);
      const tx = await contractWithSigner.archiveHabit(habitId);
      await tx.wait();
      await loadHabits();
      setMessage("Habit archived");
    } catch (e) {
      console.error(e);
      setMessage("Failed to archive");
    } finally {
      setIsLoading(false);
    }
  }, [contractWithSigner, loadHabits]);

  const deleteHabit = useCallback(async (habitId: number) => {
    if (!contractWithSigner) {
      setMessage("Contract not available");
      return;
    }
    try {
      setIsLoading(true);
      const tx = await contractWithSigner.deleteHabit(habitId);
      await tx.wait();
      await loadHabits();
      setMessage("Habit deleted");
    } catch (e) {
      console.error(e);
      setMessage("Failed to delete");
    } finally {
      setIsLoading(false);
    }
  }, [contractWithSigner, loadHabits]);

  const decryptHandles = useCallback(
    async (handles: { handle: string; contractAddress: `0x${string}` }[]) => {
      if (!instance || !ethersSigner) return {} as Record<string, bigint>;
      const sig = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [contractAddress!],
        ethersSigner,
        fhevmDecryptionSignatureStorage
      );
      if (!sig) return {} as Record<string, bigint>;
      const result = await instance.userDecrypt(
        handles,
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );
      return result as Record<string, bigint>;
    },
    [instance, ethersSigner, contractAddress, fhevmDecryptionSignatureStorage]
  );

  const decryptGrowth = useCallback(async (habitId: number) => {
    if (!contract || !instance || !ethersSigner) {
      setMessage("Not ready");
      return null;
    }

    try {
      setIsLoading(true);
      const address = await ethersSigner.getAddress();
      // getHabitGrowth also depends on msg.sender
      const handle = await contract.getHabitGrowth(habitId, { from: address });

      const result = await decryptHandles([{ handle, contractAddress: contractAddress! }]);

      const decryptedValue = result[handle as unknown as string];
      // Ensure the value is a bigint
      if (typeof decryptedValue === "bigint") {
        return decryptedValue;
      } else if (typeof decryptedValue === "number") {
        return BigInt(decryptedValue);
      } else if (typeof decryptedValue === "string") {
        return BigInt(decryptedValue);
      }
      return null;
    } catch (error) {
      console.error("Failed to decrypt growth:", error);
      setMessage("Failed to decrypt growth");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [contract, instance, ethersSigner, contractAddress, decryptHandles]);

  const decryptStats = useCallback(async (habitId: number) => {
    if (!contract || !instance || !ethersSigner) {
      setMessage("Not ready");
      return null;
    }
    try {
      setIsLoading(true);
      const address = await ethersSigner.getAddress();
      const totalHandle = await contract.getTotalProgress(habitId, { from: address });
      const streakHandle = await contract.getStreakDays(habitId, { from: address });
      const result = await decryptHandles([
        { handle: totalHandle, contractAddress: contractAddress! },
        { handle: streakHandle, contractAddress: contractAddress! },
      ]);
      const total = result[totalHandle as unknown as string] ?? 0n;
      const streak = result[streakHandle as unknown as string] ?? 0n;
      const count = await contract.getRecordCount(habitId, { from: address });
      const avg = BigInt(count) === 0n ? 0n : total / BigInt(count);
      return { total, streak, average: avg, recordCount: Number(count) };
    } catch (e) {
      console.error(e);
      setMessage("Failed to decrypt stats");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [contract, instance, ethersSigner, contractAddress, decryptHandles]);

  const loadHistory = useCallback(async (habitId: number) => {
    if (!contract || !instance || !ethersSigner) {
      setMessage("Not ready");
      return;
    }
    try {
      setIsLoading(true);
      const address = await ethersSigner.getAddress();
      const count = await contract.getRecordCount(habitId, { from: address });
      const handles: { handle: string; contractAddress: `0x${string}` }[] = [];
      const metas: { idx: number; timestamp: number; handle: string }[] = [];
      for (let i = 0; i < Number(count); i++) {
        const rec = await contract.getDailyRecord(habitId, i, { from: address });
        const timestamp = Number(rec[0]);
        const handle = rec[1] as string;
        metas.push({ idx: i, timestamp, handle });
        handles.push({ handle, contractAddress: contractAddress! });
      }
      let rows: { timestamp: number; value: bigint }[] = [];
      try {
        const decrypted = await decryptHandles(handles);
        rows = metas.map((m) => ({
          timestamp: m.timestamp,
          value: decrypted[m.handle] ?? 0n,
        }));
      } catch {
        // Fallback: try one by one, skip unauthorized handles
        const partial: { timestamp: number; value: bigint }[] = [];
        for (const m of metas) {
          try {
            const dec = await decryptHandles([{ handle: m.handle, contractAddress: contractAddress! }]);
            const v = dec[m.handle];
            if (typeof v === "bigint") {
              partial.push({ timestamp: m.timestamp, value: v });
            }
          } catch {
            // ignore unauthorized/failed
          }
        }
        rows = partial;
      }
      setHistory(rows);
    } catch (e) {
      console.error(e);
      setMessage("Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }, [contract, instance, ethersSigner, contractAddress, decryptHandles]);

  const authorizeAllDailyRecords = useCallback(async (habitId: number) => {
    if (!contractWithSigner) {
      setMessage("Contract not available");
      return;
    }
    try {
      setIsLoading(true);
      const tx = await contractWithSigner.authorizeAllDailyRecords(habitId);
      await tx.wait();
      setMessage("History authorized for decryption");
    } catch (e) {
      console.error(e);
      setMessage("Failed to authorize history");
    } finally {
      setIsLoading(false);
    }
  }, [contractWithSigner]);

  // Fixed achievements: load metadata and status (conditions shown in plaintext)
  const loadFixedAchievements = useCallback(async (habitId: number) => {
    if (!contract || !ethersSigner) {
      setMessage("Not ready");
      return;
    }
    try {
      setIsLoading(true);
      const address = await ethersSigner.getAddress();
      const countBn = await contract.getFixedAchievementCount();
      const count = Number(countBn);
      const list: {
        id: number;
        name: string;
        description: string;
        threshold?: bigint | number;
        metric?: string;
        isUnlocked: boolean;
        unlockedAt: number;
        isMinted?: boolean;
      }[] = [];
      for (let i = 0; i < count; i++) {
        const meta = await contract.getFixedAchievementMeta(i);
        const status = await contract.getFixedAchievementStatus(habitId, i, { from: address });
        // meta: [name, description, metric(uint8), threshold(uint32)]
        const metricCode = Number(meta[2] as unknown as number);
        const metric =
          metricCode === 0 ? "total" : metricCode === 1 ? "streak" : "growth";
        const threshold = Number(meta[3] as unknown as number);
        const isUnlocked = Boolean(status[0]);
        const unlockedAt = Number(status[1]);
        const isMinted = Boolean(status[2]);
        list.push({
          id: i,
          name: meta[0] as string,
          description: meta[1] as string,
          threshold,
          metric,
          isUnlocked,
          unlockedAt,
          isMinted,
        });
      }
      setAchievements(list);
    } catch (e) {
      console.error(e);
      setMessage("Failed to load achievements");
    } finally {
      setIsLoading(false);
    }
  }, [contract, ethersSigner]);

  // Fixed achievements: check and unlock (encrypted check, decrypt locally then unlock)
  const checkAndUnlockFixed = useCallback(async (habitId: number, achievementId: number) => {
    if (!contract || !contractWithSigner || !ethersSigner) {
      setMessage("Not ready");
      return false;
    }
    try {
      setIsLoading(true);
      const address = await ethersSigner.getAddress();
      // Load fixed achievement meta (plain threshold/metric)
      const meta = await contract.getFixedAchievementMeta(achievementId);
      const metricCode = Number(meta[2] as unknown as number);
      const threshold = BigInt(Number(meta[3] as unknown as number));

      // Decrypt the corresponding metric value (authorized getters)
      let metricHandle: string;
      if (metricCode === 0) {
        metricHandle = await contract.getTotalProgress(habitId, { from: address });
      } else if (metricCode === 1) {
        metricHandle = await contract.getStreakDays(habitId, { from: address });
      } else {
        metricHandle = await contract.getHabitGrowth(habitId, { from: address });
      }
      const decrypted = await decryptHandles([{ handle: metricHandle, contractAddress: contractAddress! }]);
      const value = decrypted[metricHandle as unknown as string] ?? 0n;
      const ok = value >= threshold;
      if (ok) {
        const tx = await contractWithSigner.unlockFixedAchievement(habitId, achievementId);
        await tx.wait();
        setMessage("Achievement unlocked!");
      } else {
        setMessage("Not eligible yet");
      }
      return ok;
    } catch (e) {
      console.error(e);
      setMessage("Failed to verify/unlock achievement");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [contract, contractWithSigner, ethersSigner, contractAddress, decryptHandles]);

  // Fixed achievements: mint badge (record status and emit event)
  const mintFixedAchievementBadge = useCallback(async (habitId: number, achievementId: number) => {
    if (!contractWithSigner) {
      setMessage("Contract not available");
      return;
    }
    try {
      setIsLoading(true);
      const tx = await contractWithSigner.mintFixedAchievementBadge(habitId, achievementId);
      await tx.wait();
      setMessage("Badge minted");
    } catch (e) {
      console.error(e);
      setMessage("Mint failed");
    } finally {
      setIsLoading(false);
    }
  }, [contractWithSigner]);

  // -------- Custom badges (user-defined) --------
  const metricToCode = (m: "total" | "streak" | "average" | "recordCount") =>
    m === "total" ? 0 : m === "streak" ? 1 : m === "average" ? 2 : 3;
  const codeToMetric = (c: number): "total" | "streak" | "average" | "recordCount" =>
    c === 0 ? "total" : c === 1 ? "streak" : c === 2 ? "average" : "recordCount";
  const opToCode = (op: "gt" | "gte" | "lt" | "lte" | "eq" | "neq") =>
    op === "gt" ? 0 : op === "gte" ? 1 : op === "lt" ? 2 : op === "lte" ? 3 : op === "eq" ? 4 : 5;
  const codeToOp = (c: number): "gt" | "gte" | "lt" | "lte" | "eq" | "neq" =>
    c === 0 ? "gt" : c === 1 ? "gte" : c === 2 ? "lt" : c === 3 ? "lte" : c === 4 ? "eq" : "neq";

  const createCustomBadge = useCallback(
    async (
      habitId: number,
      name: string,
      description: string,
      metric: "total" | "streak" | "average" | "recordCount",
      operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq",
      threshold: number
    ) => {
      if (!contractWithSigner) {
        setMessage("Contract not available");
        return;
      }
      try {
        setIsLoading(true);
        const tx = await contractWithSigner.createCustomBadge(
          habitId,
          name,
          description,
          metricToCode(metric),
          opToCode(operator),
          threshold
        );
        await tx.wait();
        setMessage("Custom badge created");
      } catch (e) {
        console.error(e);
        setMessage("Failed to create custom badge");
      } finally {
        setIsLoading(false);
      }
    },
    [contractWithSigner]
  );

  const loadCustomBadges = useCallback(
    async (habitId: number) => {
      if (!contract || !ethersSigner) {
        setMessage("Not ready");
        return;
      }
      try {
        setIsLoading(true);
        const address = await ethersSigner.getAddress();
        const count = await contract.getCustomBadgeCount(habitId, { from: address });
        const list: {
          id: number;
          name: string;
          description: string;
          metric: "total" | "streak" | "average" | "recordCount";
          operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
          threshold: number;
          isUnlocked: boolean;
          unlockedAt: number;
          isMinted: boolean;
        }[] = [];
        for (let i = 0; i < Number(count); i++) {
          const b = await contract.getCustomBadge(habitId, i, { from: address });
          list.push({
            id: Number(b[0]),
            name: b[1] as string,
            description: b[2] as string,
            metric: codeToMetric(Number(b[3] as unknown as number)),
            operator: codeToOp(Number(b[4] as unknown as number)),
            threshold: Number(b[5] as unknown as number),
            isUnlocked: Boolean(b[6]),
            unlockedAt: Number(b[7] as unknown as number),
            isMinted: Boolean(b[8]),
          });
        }
        setCustomBadges(list);
      } catch (e) {
        console.error(e);
        setMessage("Failed to load custom badges");
      } finally {
        setIsLoading(false);
      }
    },
    [contract, ethersSigner]
  );

  const checkAndUnlockCustom = useCallback(
    async (habitId: number, badgeId: number) => {
      if (!contract || !contractWithSigner || !ethersSigner) {
        setMessage("Not ready");
        return false;
      }
      try {
        setIsLoading(true);
        const address = await ethersSigner.getAddress();
        const b = await contract.getCustomBadge(habitId, badgeId, { from: address });
        const metric = codeToMetric(Number(b[3] as unknown as number));
        const operator = codeToOp(Number(b[4] as unknown as number));
        const threshold = BigInt(Number(b[5] as unknown as number));
        // compute current value
        const stats = await (async () => {
          const s = await decryptStats(habitId);
          return s;
        })();
        if (!stats) {
          setMessage("Failed to decrypt stats");
          return false;
        }
        let current: bigint;
        if (metric === "total") current = stats.total;
        else if (metric === "streak") current = stats.streak;
        else if (metric === "average") current = stats.average;
        else current = BigInt(stats.recordCount);

        const cmp = (operator: typeof codeToOp extends never ? never : "gt" | "gte" | "lt" | "lte" | "eq" | "neq") => {
          if (operator === "gt") return current > threshold;
          if (operator === "gte") return current >= threshold;
          if (operator === "lt") return current < threshold;
          if (operator === "lte") return current <= threshold;
          if (operator === "eq") return current === threshold;
          return current !== threshold;
        };
        const ok = cmp(operator);
        if (ok) {
          const tx = await contractWithSigner.unlockCustomBadge(habitId, badgeId);
          await tx.wait();
          setMessage("Custom badge unlocked!");
        } else {
          setMessage("Not eligible yet");
        }
        return ok;
      } catch (e) {
        console.error(e);
        setMessage("Failed to check/unlock custom badge");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [contract, contractWithSigner, ethersSigner, decryptStats]
  );

  const mintCustomBadge = useCallback(
    async (habitId: number, badgeId: number) => {
      if (!contractWithSigner) {
        setMessage("Contract not available");
        return;
      }
      try {
        setIsLoading(true);
        const tx = await contractWithSigner.mintCustomBadge(habitId, badgeId);
        await tx.wait();
        setMessage("Custom badge minted");
      } catch (e) {
        console.error(e);
        setMessage("Mint custom badge failed");
      } finally {
        setIsLoading(false);
      }
    },
    [contractWithSigner]
  );

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  return {
    habits,
    isLoading,
    message,
    createHabit,
    submitProgress,
    decryptGrowth,
    decryptStats,
    loadHistory,
    history,
    archiveHabit,
    deleteHabit,
    achievements,
    customBadges,
    loadFixedAchievements,
    checkAndUnlockFixed,
    mintFixedAchievementBadge,
    createCustomBadge,
    loadCustomBadges,
    checkAndUnlockCustom,
    mintCustomBadge,
    authorizeAllDailyRecords,
    loadHabits,
  };
}

