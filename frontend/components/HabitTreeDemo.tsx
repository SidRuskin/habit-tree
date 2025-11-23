"use client";

import { useState, useMemo, useEffect } from "react";
import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useHabitTree } from "@/hooks/useHabitTree";
import addresses from "@/addresses.json";

export const HabitTreeDemo = () => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const contractAddress = useMemo(() => {
    const envAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}` | undefined;
    if (envAddress) {
      return envAddress;
    }

    if (chainId) {
      const chainIdStr = chainId.toString();
      const chainAddresses = (addresses as Record<string, { HabitTree?: string }>)[chainIdStr];
      if (chainAddresses && chainAddresses.HabitTree) {
        return chainAddresses.HabitTree as `0x${string}`;
      }
    }

    return undefined;
  }, [chainId]) as `0x${string}` | undefined;

  const {
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
    loadFixedAchievements,
    checkAndUnlockFixed,
    mintFixedAchievementBadge,
    customBadges,
    createCustomBadge,
    loadCustomBadges,
    checkAndUnlockCustom,
    mintCustomBadge,
    authorizeAllDailyRecords,
  } = useHabitTree({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    contractAddress,
    ethersSigner,
    ethersReadonlyProvider,
  });

  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitCategory, setNewHabitCategory] = useState("");
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(null);
  const [progressValue, setProgressValue] = useState("1");
  const [decryptedGrowth, setDecryptedGrowth] = useState<bigint | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stats, setStats] = useState<{ total: bigint; streak: bigint; average: bigint; recordCount: number } | null>(null);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customMetric, setCustomMetric] = useState<"total" | "streak" | "average" | "recordCount">("total");
  const [customOp, setCustomOp] = useState<"gt" | "gte" | "lt" | "lte" | "eq" | "neq">("gt");
  const [customThreshold, setCustomThreshold] = useState("10");
  
  // UI state for Achievements & Badges panel - single active view
  const [activeAchievementView, setActiveAchievementView] = useState<"none" | "all" | "minted" | "create">("none");

  // Keep selection consistent even if a habit was deleted and removed from list
  useEffect(() => {
    if (selectedHabitId !== null && !habits.some(h => h.id === selectedHabitId)) {
      setSelectedHabitId(null);
      setDecryptedGrowth(null);
      setStats(null);
    }
  }, [habits, selectedHabitId]);

  const getTreeStage = (growth: bigint) => {
    const value = Number(growth);
    if (value < 10) return { emoji: "🌱", stage: "Seedling", color: "text-green-400" };
    if (value < 50) return { emoji: "🌿", stage: "Sapling", color: "text-green-500" };
    if (value < 100) return { emoji: "🌳", stage: "Young Tree", color: "text-emerald-400" };
    if (value < 200) return { emoji: "🌲", stage: "Mature Tree", color: "text-emerald-500" };
    return { emoji: "🌴", stage: "Ancient Tree", color: "text-emerald-600" };
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-dark-primary">
        <div className="text-center max-w-md">
          <div className="mb-8">
            <div className="text-7xl mb-6">🌳</div>
            <h1 className="text-5xl font-bold text-gold mb-4">Habit Tree</h1>
            <p className="text-xl text-gray-400">Privacy-Preserving Habit Tracker</p>
          </div>
          <div className="mb-8">
            <p className="text-gray-300 leading-relaxed">
              Track your habits with complete privacy using encrypted blockchain technology.
              Connect your wallet to get started.
            </p>
          </div>
          <button
            className="btn-gold px-12 py-4 rounded-lg text-lg font-bold"
            onClick={connect}
          >
            Connect MetaMask
          </button>
        </div>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-primary p-4">
        <div className="max-w-2xl w-full bg-dark-secondary border border-yellow-600 rounded-lg p-8">
          <div className="flex items-start gap-4">
            <div className="text-4xl text-yellow-400">⚠️</div>
            <div>
              <h2 className="text-2xl font-bold text-gold mb-3">Contract Not Found</h2>
              <p className="text-gray-300 mb-4 leading-relaxed">
                The contract address for chain ID <span className="font-mono font-semibold text-gold">{chainId || "unknown"}</span> could not be located.
              </p>
              <div className="space-y-2 text-sm text-gray-400">
                <p className="font-semibold text-gray-200">Please follow one of these steps:</p>
                <ul className="list-decimal list-inside ml-4 space-y-1">
                  <li>Set the <code className="bg-dark-tertiary px-2 py-1 rounded font-mono text-gold">NEXT_PUBLIC_CONTRACT_ADDRESS</code> environment variable</li>
                  <li>Deploy the contract and run <code className="bg-dark-tertiary px-2 py-1 rounded font-mono text-gold">npm run genabi</code> to generate addresses.json</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedHabit = habits.find(h => h.id === selectedHabitId);

  return (
    <div className="min-h-screen bg-dark-primary">
      {/* Header */}
      <header className="bg-dark-secondary border-b border-dark shadow-lg">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">🌳</span>
              <div>
                <h1 className="text-3xl font-bold text-gold">Habit Tree</h1>
                <p className="text-sm text-gray-400">Privacy-Preserving Habit Tracker</p>
              </div>
            </div>
            <div className="text-right bg-dark-tertiary px-4 py-3 rounded-lg border border-dark">
              <div className="text-xs text-gray-400 mb-1">Connected Wallet</div>
              <div className="text-sm font-mono text-gold">{accounts[0]?.substring(0, 10)}...{accounts[0]?.substring(accounts[0].length - 8)}</div>
              <div className="text-xs text-gray-400 mt-1">Chain ID: <span className="text-gold font-semibold">{chainId}</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* Status Messages */}
      {(message || fhevmError) && (
        <div className="container mx-auto px-6 mt-6">
          {fhevmError && (
            <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">❌</span>
                <div>
                  <div className="font-semibold text-red-400">Error</div>
                  <div className="text-sm text-red-300">{fhevmError.message}</div>
                </div>
              </div>
            </div>
          )}
          {message && !fhevmError && (
            <div className="bg-blue-900 bg-opacity-20 border border-blue-600 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">ℹ️</span>
                <div className="text-blue-200">{message}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Create & List */}
          <div className="lg:col-span-1 space-y-6">
            {/* Create New Habit Card */}
            <div className="card-dark">
              <h2 className="text-xl font-bold text-gold mb-4 flex items-center gap-2">
                <span>✨</span>
                Create New Habit
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Habit Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Morning Meditation"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    className="w-full input-dark"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Category</label>
                  <input
                    type="text"
                    placeholder="e.g., Health, Learning, Fitness"
                    value={newHabitCategory}
                    onChange={(e) => setNewHabitCategory(e.target.value)}
                    className="w-full input-dark"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!newHabitName.trim()) {
                      alert("Please enter a habit name");
                      return;
                    }
                    await createHabit(newHabitName, newHabitCategory || "General");
                    setNewHabitName("");
                    setNewHabitCategory("");
                  }}
                  disabled={isLoading}
                  className="w-full btn-gold py-3 rounded-lg"
                >
                  {isLoading ? "Creating..." : "Create Habit"}
                </button>
              </div>
            </div>

            {/* Habits List Card */}
            <div className="card-dark">
              <h2 className="text-xl font-bold text-gold mb-4 flex items-center gap-2">
                <span>📋</span>
                Your Habits
              </h2>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Filter by category..."
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full input-dark"
                />
              </div>
              {habits.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-5xl mb-3">🌱</div>
                  <p className="font-semibold">No habits yet</p>
                  <p className="text-sm mt-1">Create your first habit above!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {habits
                    .filter((h) =>
                      categoryFilter.trim()
                        ? (h.category || "").toLowerCase().includes(categoryFilter.toLowerCase())
                        : true
                    )
                    .map((habit) => (
                    <div
                      key={habit.id}
                      className={`bg-dark-tertiary border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedHabitId === habit.id 
                          ? "border-gold shadow-lg shadow-gold/20" 
                          : "border-dark hover:border-gray-600"
                      }`}
                      onClick={async () => {
                        setSelectedHabitId(habit.id);
                        setDecryptedGrowth(null);
                        setStats(null);
                        // Refresh achievements and badges when selecting a habit
                        await Promise.all([
                          loadFixedAchievements(habit.id),
                          loadCustomBadges(habit.id),
                        ]);
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-white">{habit.name}</h3>
                          <p className="text-sm text-gray-400 mt-1">
                            <span className="inline-block bg-gold text-dark-primary px-2 py-1 rounded text-xs font-semibold">
                              {habit.category}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveHabit(habit.id);
                          }}
                          disabled={isLoading || !habit.isActive}
                          className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          Archive
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHabit(habit.id);
                          }}
                          disabled={isLoading || !habit.isArchived}
                          className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedHabitId === null ? (
              <div className="card-dark text-center py-20">
                <div className="text-7xl mb-6">👈</div>
                <h3 className="text-3xl font-bold text-gold mb-3">Select a Habit</h3>
                <p className="text-gray-400 text-lg">Choose a habit from the list to view details and track progress</p>
              </div>
            ) : (
              <>
                {/* Habit Details */}
                <div className="card-dark">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-dark">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">{selectedHabit?.name}</h2>
                      <p className="text-sm text-gray-400">
                        <span className="inline-block bg-gold text-dark-primary px-3 py-1 rounded font-semibold">
                          {selectedHabit?.category}
                        </span>
                      </p>
                    </div>
                    {decryptedGrowth !== null && (
                      <div className="text-right bg-dark-tertiary px-6 py-4 rounded-lg border border-dark">
                        <div className="text-5xl mb-2">{getTreeStage(decryptedGrowth).emoji}</div>
                        <div className={`text-lg font-bold ${getTreeStage(decryptedGrowth).color}`}>
                          {getTreeStage(decryptedGrowth).stage}
                        </div>
                        <div className="text-sm text-gold mt-1 font-semibold">Growth: {decryptedGrowth.toString()}</div>
                      </div>
                    )}
                  </div>

                  {/* Track Progress */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gold mb-4">📈 Track Progress</h3>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Progress Value</label>
                        <input
                          type="number"
                          min="1"
                          value={progressValue}
                          onChange={(e) => setProgressValue(e.target.value)}
                          className="w-full input-dark"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          onClick={async () => {
                            if (selectedHabitId === null) {
                              alert("Please select a habit");
                              return;
                            }
                            await submitProgress(selectedHabitId, Number.parseInt(progressValue));
                          }}
                          disabled={isLoading || !selectedHabit?.isActive}
                          className="btn-gold px-6 py-3 rounded-lg"
                        >
                          {isLoading ? "Submitting..." : "Submit"}
                        </button>
                        <button
                          onClick={async () => {
                            if (selectedHabitId === null) {
                              alert("Please select a habit");
                              return;
                            }
                            const growth = await decryptGrowth(selectedHabitId);
                            if (growth !== null) {
                              setDecryptedGrowth(growth);
                            }
                          }}
                          disabled={isLoading}
                          className="btn-outline-gold px-6 py-3 rounded-lg"
                        >
                          {isLoading ? "Decrypting..." : "Decrypt Growth"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div>
                    <h3 className="text-lg font-bold text-gold mb-4">📊 Statistics & History</h3>
                    <div className="flex flex-wrap gap-3 mb-4">
                      <button
                        onClick={async () => {
                          if (selectedHabitId === null) {
                            alert("Please select a habit");
                            return;
                          }
                          const s = await decryptStats(selectedHabitId);
                          if (s) setStats(s);
                        }}
                        disabled={isLoading}
                        className="btn-gold px-4 py-2 rounded-lg text-sm"
                      >
                        {isLoading ? "Loading..." : "Decrypt Stats"}
                      </button>
                      <button
                        onClick={async () => {
                          if (selectedHabitId === null) {
                            alert("Please select a habit");
                            return;
                          }
                          await loadHistory(selectedHabitId);
                        }}
                        disabled={isLoading}
                        className="btn-outline-gold px-4 py-2 rounded-lg text-sm"
                      >
                        {isLoading ? "Loading..." : "Load History"}
                      </button>
                      <button
                        onClick={() => selectedHabitId !== null && authorizeAllDailyRecords(selectedHabitId)}
                        disabled={isLoading || !(selectedHabit?.isActive || selectedHabit?.isArchived)}
                        className="btn-outline-gold px-4 py-2 rounded-lg text-sm"
                      >
                        {isLoading ? "Authorizing..." : "Authorize History"}
                      </button>
                    </div>

                    {stats && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-dark-tertiary p-4 rounded-lg border border-dark">
                          <div className="text-sm text-gray-400 mb-1">Total Progress</div>
                          <div className="text-2xl font-bold text-gold">{stats.total.toString()}</div>
                        </div>
                        <div className="bg-dark-tertiary p-4 rounded-lg border border-dark">
                          <div className="text-sm text-gray-400 mb-1">Streak Days</div>
                          <div className="text-2xl font-bold text-gold">{stats.streak.toString()}</div>
                        </div>
                        <div className="bg-dark-tertiary p-4 rounded-lg border border-dark">
                          <div className="text-sm text-gray-400 mb-1">Average</div>
                          <div className="text-2xl font-bold text-gold">{stats.average.toString()}</div>
                        </div>
                        <div className="bg-dark-tertiary p-4 rounded-lg border border-dark">
                          <div className="text-sm text-gray-400 mb-1">Total Records</div>
                          <div className="text-2xl font-bold text-gold">{stats.recordCount}</div>
                        </div>
                      </div>
                    )}

                    {history.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-white mb-3">Progress History</h4>
                        <div className="max-h-64 overflow-auto border border-dark rounded-lg">
                          <table className="min-w-full">
                            <thead className="bg-dark-tertiary sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-dark">Date & Time</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-dark">Progress Value</th>
                              </tr>
                            </thead>
                            <tbody className="bg-dark-secondary">
                              {history.map((row, idx) => (
                                <tr key={idx} className="border-b border-dark hover:bg-dark-tertiary transition-colors">
                                  <td className="px-4 py-3 text-sm text-gray-400">{new Date(row.timestamp * 1000).toLocaleString()}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-gold">{row.value.toString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Achievements */}
                <div className="card-dark">
                  <h2 className="text-xl font-bold text-gold mb-4 flex items-center gap-2">
                    <span>🏆</span>
                    Achievements & Badges
                  </h2>
                  
                  {/* Control Buttons */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    <button
                      onClick={async () => {
                        if (selectedHabitId === null) {
                          alert("Please select a habit");
                          return;
                        }
                        if (activeAchievementView !== "all") {
                          await Promise.all([
                            loadFixedAchievements(selectedHabitId),
                            loadCustomBadges(selectedHabitId),
                          ]);
                          setActiveAchievementView("all");
                        } else {
                          setActiveAchievementView("none");
                        }
                      }}
                      disabled={isLoading}
                      className={`px-6 py-3 rounded-lg transition-all ${
                        activeAchievementView === "all" 
                          ? "btn-gold" 
                          : "btn-outline-gold"
                      }`}
                    >
                      {isLoading ? "Loading..." : "All Achievements"}
                    </button>
                    
                    <button
                      onClick={() => {
                        if (activeAchievementView !== "minted") {
                          setActiveAchievementView("minted");
                        } else {
                          setActiveAchievementView("none");
                        }
                      }}
                      className={`px-6 py-3 rounded-lg transition-all ${
                        activeAchievementView === "minted" 
                          ? "btn-gold" 
                          : "btn-outline-gold"
                      }`}
                    >
                      Minted Badges
                    </button>
                    
                    <button
                      onClick={() => {
                        if (activeAchievementView !== "create") {
                          setActiveAchievementView("create");
                        } else {
                          setActiveAchievementView("none");
                        }
                      }}
                      className={`px-6 py-3 rounded-lg transition-all ${
                        activeAchievementView === "create" 
                          ? "btn-gold" 
                          : "btn-outline-gold"
                      }`}
                    >
                      Create Badge
                    </button>
                    
                    <button
                      onClick={async () => {
                        if (selectedHabitId === null) {
                          alert("Please select a habit");
                          return;
                        }
                        await Promise.all([
                          loadFixedAchievements(selectedHabitId),
                          loadCustomBadges(selectedHabitId),
                        ]);
                      }}
                      disabled={isLoading}
                      className="btn-outline-gold px-6 py-3 rounded-lg"
                      title="Refresh achievement status"
                    >
                      {isLoading ? "Refreshing..." : "🔄 Refresh"}
                    </button>
                  </div>

                  {/* All Achievements View */}
                  {activeAchievementView === "all" && (
                    <>
                  {/* Fixed Achievements */}
                  {achievements.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-bold text-white mb-4">Fixed Achievements</h3>
                      <div className="space-y-3">
                        {achievements.map((a) => (
                          <div key={a.id} className="bg-dark-tertiary border border-dark rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-3xl">{a.isUnlocked ? "🏆" : "🔒"}</span>
                                  <div>
                                    <h4 className="font-bold text-white text-lg">{a.name}</h4>
                                    <p className="text-sm text-gray-400">{a.description}</p>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 mb-2">
                                  <span className="font-semibold text-gray-400">Condition:</span>{" "}
                                  {a.metric === "total" && "Total ≥ "}
                                  {a.metric === "streak" && "Streak ≥ "}
                                  {a.metric === "growth" && "Growth ≥ "}
                                  {a.threshold !== undefined ? a.threshold.toString() : "-"}
                                </div>
                                <div className="flex gap-3">
                                  <span className={`px-3 py-1 rounded text-xs font-semibold ${a.isUnlocked ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                                    {a.isUnlocked ? "✓ Unlocked" : "Locked"}
                                  </span>
                                  {a.isUnlocked && (
                                    <span className={`px-3 py-1 rounded text-xs font-semibold ${a.isMinted ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                                      {a.isMinted ? "✓ Minted" : "Not Minted"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 ml-4">
                                <button
                                  onClick={() => checkAndUnlockFixed(selectedHabitId!, a.id)}
                                  disabled={isLoading || a.isUnlocked}
                                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                                >
                                  Unlock
                                </button>
                                <button
                                  onClick={() => mintFixedAchievementBadge(selectedHabitId!, a.id)}
                                  disabled={isLoading || !a.isUnlocked || a.isMinted}
                                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                                >
                                  Mint
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Badges List */}
                  {customBadges?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold text-white mb-4">Custom Badges</h3>
                      <div className="space-y-3">
                        {customBadges.map((b) => (
                          <div key={b.id} className="bg-dark-tertiary border border-dark rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-3xl">{b.isUnlocked ? "🏅" : "🔒"}</span>
                                  <div>
                                    <h4 className="font-bold text-white text-lg">{b.name}</h4>
                                    <p className="text-sm text-gray-400">{b.description}</p>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 mb-2">
                                  <span className="font-semibold text-gray-400">Condition:</span> {b.metric} {b.operator} {b.threshold}
                                </div>
                                <div className="flex gap-3">
                                  <span className={`px-3 py-1 rounded text-xs font-semibold ${b.isUnlocked ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                                    {b.isUnlocked ? "✓ Unlocked" : "Locked"}
                                  </span>
                                  {b.isUnlocked && (
                                    <span className={`px-3 py-1 rounded text-xs font-semibold ${b.isMinted ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                                      {b.isMinted ? "✓ Minted" : "Not Minted"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 ml-4">
                                <button
                                  onClick={async () => {
                                    if (selectedHabitId === null) return;
                                    const ok = await checkAndUnlockCustom(selectedHabitId, b.id);
                                    if (ok) await loadCustomBadges(selectedHabitId);
                                  }}
                                  disabled={isLoading || b.isUnlocked}
                                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                                >
                                  Unlock
                                </button>
                                <button
                                  onClick={async () => {
                                    if (selectedHabitId === null) return;
                                    await mintCustomBadge(selectedHabitId, b.id);
                                    await loadCustomBadges(selectedHabitId);
                                  }}
                                  disabled={isLoading || !b.isUnlocked || b.isMinted}
                                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                                >
                                  Mint
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                  )}

                  {/* Minted Badges View */}
                  {activeAchievementView === "minted" && (
                  <div className="bg-dark-tertiary border border-dark rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gold mb-4">🎖️ My Minted Badges</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-sm font-semibold text-gray-300 mb-3">Fixed Badges</div>
                        {achievements.filter(a => a.isMinted).length === 0 ? (
                          <div className="text-sm text-gray-500">No fixed badges minted yet.</div>
                        ) : (
                          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                            {achievements.filter(a => a.isMinted).map(a => (
                              <li key={`fixed-${a.id}`}>{a.name}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-300 mb-3">Custom Badges</div>
                        {customBadges?.filter(b => b.isMinted).length === 0 ? (
                          <div className="text-sm text-gray-500">No custom badges minted yet.</div>
                        ) : (
                          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                            {customBadges.filter(b => b.isMinted).map(b => (
                              <li key={`custom-${b.id}`}>{b.name}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Create Custom Badge View */}
                  {activeAchievementView === "create" && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">Create Custom Badge</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Badge Name</label>
                        <input
                          type="text"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className="w-full input-dark"
                          placeholder="e.g., Super Achiever"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                        <input
                          type="text"
                          value={customDesc}
                          onChange={(e) => setCustomDesc(e.target.value)}
                          className="w-full input-dark"
                          placeholder="Describe the achievement"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Metric</label>
                        <select
                          value={customMetric}
                          onChange={(e) => setCustomMetric(e.target.value as any)}
                          className="w-full input-dark"
                        >
                          <option value="total">Total</option>
                          <option value="streak">Streak</option>
                          <option value="average">Average</option>
                          <option value="recordCount">Record Count</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Operator</label>
                        <select
                          value={customOp}
                          onChange={(e) => setCustomOp(e.target.value as any)}
                          className="w-full input-dark"
                        >
                          <option value="gt">&gt;</option>
                          <option value="gte">&gt;=</option>
                          <option value="lt">&lt;</option>
                          <option value="lte">&lt;=</option>
                          <option value="eq">=</option>
                          <option value="neq">!=</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Threshold</label>
                        <input
                          type="number"
                          min="0"
                          value={customThreshold}
                          onChange={(e) => setCustomThreshold(e.target.value)}
                          className="w-full input-dark"
                        />
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (selectedHabitId === null) {
                          alert("Please select a habit");
                          return;
                        }
                        if (!customName.trim()) {
                          alert("Please enter a badge name");
                          return;
                        }
                        await createCustomBadge(
                          selectedHabitId,
                          customName,
                          customDesc,
                          customMetric,
                          customOp,
                          Number.parseInt(customThreshold || "0")
                        );
                        await loadCustomBadges(selectedHabitId);
                        setCustomName("");
                        setCustomDesc("");
                        setCustomMetric("total");
                        setCustomOp("gt");
                        setCustomThreshold("10");
                      }}
                      disabled={isLoading}
                      className="w-full btn-gold py-3 rounded-lg"
                    >
                      {isLoading ? "Creating..." : "Create Custom Badge"}
                    </button>
                  </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
