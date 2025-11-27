// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title HabitTree - Encrypted Habit Tracking DApp
/// @notice A privacy-preserving habit tracking system using FHEVM
contract HabitTree is ZamaEthereumConfig {
    // Struct to store habit information
    struct Habit {
        uint256 id;
        string name;
        string category;
        bool isActive;
        bool isArchived;
        uint256 createdAt;
    }

    // Struct to store daily progress record
    struct DailyRecord {
        uint256 timestamp;
        euint32 progress; // Encrypted progress value
    }

    // Struct to store achievement
    struct Achievement {
        uint256 id;
        string name;
        string description;
        euint32 threshold; // Encrypted threshold value
        bool isUnlocked;
        uint256 unlockedAt;
    }

    // Mapping from user address to their habits
    mapping(address => mapping(uint256 => Habit)) public habits;
    mapping(address => uint256) public habitCount;

    // Mapping from user address to habit ID to growth value (encrypted)
    mapping(address => mapping(uint256 => euint32)) public habitGrowth;

    // Mapping from user address to habit ID to daily records
    mapping(address => mapping(uint256 => mapping(uint256 => DailyRecord))) public dailyRecords;
    mapping(address => mapping(uint256 => uint256)) public recordCount;

    // Mapping from user address to habit ID to achievements
    mapping(address => mapping(uint256 => Achievement[])) public achievements;
    mapping(address => mapping(uint256 => uint256)) public achievementCount;

    // Mapping from user address to habit ID to statistics (encrypted)
    mapping(address => mapping(uint256 => euint32)) public totalProgress;
    // Note: averageProgress and streakDays are calculated on frontend after decryption
    // as FHE division and complex comparisons are limited
    mapping(address => mapping(uint256 => euint32)) public streakDays;

    // Events
    event HabitCreated(address indexed user, uint256 indexed habitId, string name, string category);
    event HabitArchived(address indexed user, uint256 indexed habitId);
    event HabitDeleted(address indexed user, uint256 indexed habitId);
    event ProgressSubmitted(address indexed user, uint256 indexed habitId, uint256 timestamp);
    event AchievementUnlocked(address indexed user, uint256 indexed habitId, uint256 indexed achievementId);
    event FixedAchievementUnlocked(address indexed user, uint256 indexed habitId, uint8 indexed achievementId);
    event FixedAchievementMinted(address indexed user, uint256 indexed habitId, uint8 indexed achievementId);
    event CustomBadgeCreated(address indexed user, uint256 indexed habitId, uint256 indexed badgeId);
    event CustomBadgeUnlocked(address indexed user, uint256 indexed habitId, uint256 indexed badgeId);
    event CustomBadgeMinted(address indexed user, uint256 indexed habitId, uint256 indexed badgeId);

    // Fixed achievements
    enum Metric {
        TotalProgress,
        StreakDays,
        Growth
    }

    // Fixed achievements state
    mapping(address => mapping(uint256 => mapping(uint8 => bool))) public fixedAchievementUnlocked;
    mapping(address => mapping(uint256 => mapping(uint8 => uint256))) public fixedAchievementUnlockedAt;
    mapping(address => mapping(uint256 => mapping(uint8 => bool))) public fixedAchievementMinted;

    // Custom badges
    struct CustomBadge {
        uint256 id;
        string name;
        string description;
        uint8 metric; // 0=total,1=streak,2=growth,3=average(client),4=recordCount(client). We will use 0..3 in frontend for total/streak/average/recordCount
        uint8 operatorCode; // 0:>,1:>=,2:<,3:<=,4:==,5:!= (stored for UI; verification happens client-side)
        uint32 threshold; // plaintext threshold (client performs comparison using decrypted stats)
        bool isUnlocked;
        uint256 unlockedAt;
        bool isMinted;
    }
    mapping(address => mapping(uint256 => mapping(uint256 => CustomBadge))) public customBadges;
    mapping(address => mapping(uint256 => uint256)) public customBadgeCount;

    function createCustomBadge(
        uint256 habitId,
        string memory name,
        string memory description,
        uint8 metric,
        uint8 operatorCode,
        uint32 threshold
    ) external {
        require(
            habits[msg.sender][habitId].isActive || habits[msg.sender][habitId].isArchived,
            "Habit not found"
        );
        uint256 badgeId = customBadgeCount[msg.sender][habitId];
        customBadges[msg.sender][habitId][badgeId] = CustomBadge({
            id: badgeId,
            name: name,
            description: description,
            metric: metric,
            operatorCode: operatorCode,
            threshold: threshold,
            isUnlocked: false,
            unlockedAt: 0,
            isMinted: false
        });
        customBadgeCount[msg.sender][habitId]++;
        emit CustomBadgeCreated(msg.sender, habitId, badgeId);
    }

    function getCustomBadgeCount(uint256 habitId) external view returns (uint256) {
        return customBadgeCount[msg.sender][habitId];
    }

    function getCustomBadge(uint256 habitId, uint256 badgeId)
        external
        view
        returns (
            uint256 id,
            string memory name,
            string memory description,
            uint8 metric,
            uint8 operatorCode,
            uint32 threshold,
            bool isUnlocked,
            uint256 unlockedAt,
            bool isMinted
        )
    {
        CustomBadge memory b = customBadges[msg.sender][habitId][badgeId];
        return (
            b.id,
            b.name,
            b.description,
            b.metric,
            b.operatorCode,
            b.threshold,
            b.isUnlocked,
            b.unlockedAt,
            b.isMinted
        );
    }

    function unlockCustomBadge(uint256 habitId, uint256 badgeId) external {
        require(
            habits[msg.sender][habitId].isActive || habits[msg.sender][habitId].isArchived,
            "Habit not found"
        );
        CustomBadge storage b = customBadges[msg.sender][habitId][badgeId];
        require(!b.isUnlocked, "Already unlocked");
        b.isUnlocked = true;
        b.unlockedAt = block.timestamp;
        emit CustomBadgeUnlocked(msg.sender, habitId, badgeId);
    }

    function mintCustomBadge(uint256 habitId, uint256 badgeId) external {
        CustomBadge storage b = customBadges[msg.sender][habitId][badgeId];
        require(b.isUnlocked, "Badge not unlocked");
        require(!b.isMinted, "Already minted");
        b.isMinted = true;
        emit CustomBadgeMinted(msg.sender, habitId, badgeId);
    }
    /// @notice Create a new habit
    /// @param name The name of the habit
    /// @param category The category of the habit
    function createHabit(string memory name, string memory category) external {
        uint256 habitId = habitCount[msg.sender];
        habits[msg.sender][habitId] = Habit({
            id: habitId,
            name: name,
            category: category,
            isActive: true,
            isArchived: false,
            createdAt: block.timestamp
        });
        habitCount[msg.sender]++;

        // Initialize encrypted growth value to zero
        euint32 zero = FHE.asEuint32(0);
        habitGrowth[msg.sender][habitId] = zero;
        totalProgress[msg.sender][habitId] = zero;
        streakDays[msg.sender][habitId] = zero;

        // Allow contract and user to decrypt
        FHE.allowThis(habitGrowth[msg.sender][habitId]);
        FHE.allow(habitGrowth[msg.sender][habitId], msg.sender);

        emit HabitCreated(msg.sender, habitId, name, category);
    }

    /// @notice Archive a habit
    /// @param habitId The ID of the habit to archive
    function archiveHabit(uint256 habitId) external {
        require(habits[msg.sender][habitId].isActive, "Habit not found or already archived");
        habits[msg.sender][habitId].isActive = false;
        habits[msg.sender][habitId].isArchived = true;
        emit HabitArchived(msg.sender, habitId);
    }

    /// @notice Delete a habit (only if archived)
    /// @param habitId The ID of the habit to delete
    function deleteHabit(uint256 habitId) external {
        require(habits[msg.sender][habitId].isArchived, "Habit must be archived before deletion");
        delete habits[msg.sender][habitId];
        emit HabitDeleted(msg.sender, habitId);
    }

    /// @notice Submit daily progress (encrypted)
    /// @param habitId The ID of the habit
    /// @param inputEuint32 The encrypted progress value
    /// @param inputProof The input proof
    function submitProgress(
        uint256 habitId,
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        require(habits[msg.sender][habitId].isActive, "Habit not found or not active");

        euint32 encryptedProgress = FHE.fromExternal(inputEuint32, inputProof);

        // Add to growth value
        habitGrowth[msg.sender][habitId] = FHE.add(habitGrowth[msg.sender][habitId], encryptedProgress);

        // Update total progress
        totalProgress[msg.sender][habitId] = FHE.add(totalProgress[msg.sender][habitId], encryptedProgress);

        // Update record count and store daily record
        uint256 recordIndex = recordCount[msg.sender][habitId];
        dailyRecords[msg.sender][habitId][recordIndex] = DailyRecord({
            timestamp: block.timestamp,
            progress: encryptedProgress
        });
        recordCount[msg.sender][habitId]++;

        // Allow decrypt on the stored daily record
        FHE.allowThis(encryptedProgress);
        FHE.allow(encryptedProgress, msg.sender);

        // Note: Average calculation is done on frontend after decryption
        // FHE division is not directly supported, so we store totalProgress
        // and calculate average on the client side

        // Note: Streak calculation is simplified - just increment if progress > 0
        // In production, you'd want to check consecutive days on the frontend
        // For now, we'll track this on the frontend after decryption
        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);
        ebool hasProgress = FHE.gt(encryptedProgress, zero);
        streakDays[msg.sender][habitId] = FHE.select(hasProgress, 
            FHE.add(streakDays[msg.sender][habitId], one), 
            streakDays[msg.sender][habitId]);

        // Allow contract and user to decrypt updated values
        FHE.allowThis(habitGrowth[msg.sender][habitId]);
        FHE.allow(habitGrowth[msg.sender][habitId], msg.sender);
        FHE.allowThis(totalProgress[msg.sender][habitId]);
        FHE.allow(totalProgress[msg.sender][habitId], msg.sender);
        FHE.allowThis(streakDays[msg.sender][habitId]);
        FHE.allow(streakDays[msg.sender][habitId], msg.sender);

        emit ProgressSubmitted(msg.sender, habitId, block.timestamp);
    }

    /// @notice Get habit growth value (encrypted)
    /// @param habitId The ID of the habit
    /// @return The encrypted growth value
    function getHabitGrowth(uint256 habitId) external view returns (euint32) {
        return habitGrowth[msg.sender][habitId];
    }

    /// @notice Get total progress (encrypted)
    /// @param habitId The ID of the habit
    /// @return The encrypted total progress
    function getTotalProgress(uint256 habitId) external view returns (euint32) {
        return totalProgress[msg.sender][habitId];
    }

    /// @notice Get average progress (calculated on frontend from totalProgress / recordCount)
    /// Note: FHE division is not directly supported, so average is calculated client-side

    /// @notice Get streak days (encrypted)
    /// @param habitId The ID of the habit
    /// @return The encrypted streak days
    function getStreakDays(uint256 habitId) external view returns (euint32) {
        return streakDays[msg.sender][habitId];
    }

    /// @notice Get daily record (encrypted)
    /// @param habitId The ID of the habit
    /// @param recordIndex The index of the record
    /// @return timestamp The timestamp of the record
    /// @return progress The encrypted progress value
    function getDailyRecord(uint256 habitId, uint256 recordIndex) 
        external 
        view 
        returns (uint256 timestamp, euint32 progress) 
    {
        DailyRecord memory record = dailyRecords[msg.sender][habitId][recordIndex];
        return (record.timestamp, record.progress);
    }

    /// @notice Create an achievement for a habit
    /// @param habitId The ID of the habit
    /// @param name The name of the achievement
    /// @param description The description of the achievement
    /// @param thresholdEuint32 The encrypted threshold value
    /// @param thresholdProof The threshold proof
    function createAchievement(
        uint256 habitId,
        string memory name,
        string memory description,
        externalEuint32 thresholdEuint32,
        bytes calldata thresholdProof
    ) external {
        require(habits[msg.sender][habitId].isActive, "Habit not found or not active");

        euint32 encryptedThreshold = FHE.fromExternal(thresholdEuint32, thresholdProof);

        uint256 achievementId = achievementCount[msg.sender][habitId];
        achievements[msg.sender][habitId].push(Achievement({
            id: achievementId,
            name: name,
            description: description,
            threshold: encryptedThreshold,
            isUnlocked: false,
            unlockedAt: 0
        }));
        achievementCount[msg.sender][habitId]++;

        // Allow contract and user to decrypt threshold
        FHE.allowThis(encryptedThreshold);
        FHE.allow(encryptedThreshold, msg.sender);
    }

    /// @notice Check and unlock achievements (called by frontend after decryption)
    /// @param habitId The ID of the habit
    /// @param achievementId The ID of the achievement to unlock
    function unlockAchievement(uint256 habitId, uint256 achievementId) external {
        require(habits[msg.sender][habitId].isActive, "Habit not found or not active");
        require(achievementId < achievementCount[msg.sender][habitId], "Achievement not found");
        
        Achievement storage achievement = achievements[msg.sender][habitId][achievementId];
        require(!achievement.isUnlocked, "Achievement already unlocked");
        
        achievement.isUnlocked = true;
        achievement.unlockedAt = block.timestamp;
        emit AchievementUnlocked(msg.sender, habitId, achievementId);
    }

    /// @notice Get achievement count for a habit
    /// @param habitId The ID of the habit
    /// @return The number of achievements
    function getAchievementCount(uint256 habitId) external view returns (uint256) {
        return achievementCount[msg.sender][habitId];
    }

    /// @notice Get achievement by index
    /// @param habitId The ID of the habit
    /// @param index The index of the achievement
    /// @return id The achievement ID
    /// @return name The achievement name
    /// @return description The achievement description
    /// @return threshold The encrypted threshold
    /// @return isUnlocked Whether the achievement is unlocked
    /// @return unlockedAt When the achievement was unlocked
    function getAchievement(uint256 habitId, uint256 index)
        external
        view
        returns (
            uint256 id,
            string memory name,
            string memory description,
            euint32 threshold,
            bool isUnlocked,
            uint256 unlockedAt
        )
    {
        Achievement memory achievement = achievements[msg.sender][habitId][index];
        return (
            achievement.id,
            achievement.name,
            achievement.description,
            achievement.threshold,
            achievement.isUnlocked,
            achievement.unlockedAt
        );
    }

    /// @notice Encrypted check if achievement is unlocked (growth >= threshold)
    /// @dev Returns encrypted 1 if should unlock, else encrypted 0
    function checkAchievementEncrypted(uint256 habitId, uint256 achievementId)
        external
        returns (euint32)
    {
        require(habits[msg.sender][habitId].isActive, "Habit not found or not active");
        require(achievementId < achievementCount[msg.sender][habitId], "Achievement not found");

        Achievement memory achievement = achievements[msg.sender][habitId][achievementId];
        ebool ok = FHE.gt(habitGrowth[msg.sender][habitId], achievement.threshold);
        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);
        euint32 result = FHE.select(ok, one, zero);
        FHE.allow(result, msg.sender);
        return result;
    }

    /// @notice Number of fixed achievements
    function getFixedAchievementCount() external pure returns (uint8) {
        return 5;
    }

    /// @notice Get fixed achievement metadata
    /// @dev metric: 0=TotalProgress, 1=StreakDays, 2=Growth
    function getFixedAchievementMeta(uint8 achievementId)
        external
        pure
        returns (string memory name, string memory description, uint8 metric, uint32 threshold)
    {
        if (achievementId == 0) {
            return ("First Check-in", "Submit your first progress", uint8(Metric.TotalProgress), 1);
        } else if (achievementId == 1) {
            return ("7-day Streak", "Reach a 7-day streak", uint8(Metric.StreakDays), 7);
        } else if (achievementId == 2) {
            return ("30-day Streak", "Reach a 30-day streak", uint8(Metric.StreakDays), 30);
        } else if (achievementId == 3) {
            return ("100 Points", "Accumulate 100 total points", uint8(Metric.TotalProgress), 100);
        } else if (achievementId == 4) {
            return ("500 Points", "Accumulate 500 total points", uint8(Metric.TotalProgress), 500);
        }
        return ("", "", uint8(Metric.TotalProgress), 0);
    }

    /// @notice Encrypted check for fixed achievement (returns 1 if eligible else 0)
    function checkFixedAchievementEncrypted(uint256 habitId, uint8 achievementId) external returns (euint32) {
        require(
            habits[msg.sender][habitId].isActive || habits[msg.sender][habitId].isArchived,
            "Habit not found"
        );

        // Resolve metric and threshold
        uint8 m;
        uint32 t;
        {
            string memory _n;
            string memory _d;
            (_n, _d, m, t) = this.getFixedAchievementMeta(achievementId);
        }
        euint32 thresholdMinusOne = FHE.asEuint32(t > 0 ? t - 1 : 0);

        ebool ok;
        if (m == uint8(Metric.TotalProgress)) {
            ok = FHE.gt(totalProgress[msg.sender][habitId], thresholdMinusOne);
        } else if (m == uint8(Metric.StreakDays)) {
            ok = FHE.gt(streakDays[msg.sender][habitId], thresholdMinusOne);
        } else {
            ok = FHE.gt(habitGrowth[msg.sender][habitId], thresholdMinusOne);
        }

        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);
        euint32 result = FHE.select(ok, one, zero);
        FHE.allow(result, msg.sender);
        return result;
    }

    /// @notice Mark fixed achievement as unlocked (should be called after client-side decryption check)
    function unlockFixedAchievement(uint256 habitId, uint8 achievementId) external {
        require(
            habits[msg.sender][habitId].isActive || habits[msg.sender][habitId].isArchived,
            "Habit not found"
        );
        require(!fixedAchievementUnlocked[msg.sender][habitId][achievementId], "Already unlocked");
        fixedAchievementUnlocked[msg.sender][habitId][achievementId] = true;
        fixedAchievementUnlockedAt[msg.sender][habitId][achievementId] = block.timestamp;
        emit FixedAchievementUnlocked(msg.sender, habitId, achievementId);
    }

    /// @notice Get fixed achievement status for user/habit
    function getFixedAchievementStatus(uint256 habitId, uint8 achievementId)
        external
        view
        returns (bool isUnlocked, uint256 unlockedAt, bool isMinted)
    {
        isUnlocked = fixedAchievementUnlocked[msg.sender][habitId][achievementId];
        unlockedAt = fixedAchievementUnlockedAt[msg.sender][habitId][achievementId];
        isMinted = fixedAchievementMinted[msg.sender][habitId][achievementId];
    }

    /// @notice 'Mint' a badge (record minted status) after unlocking
    function mintFixedAchievementBadge(uint256 habitId, uint8 achievementId) external {
        require(fixedAchievementUnlocked[msg.sender][habitId][achievementId], "Achievement not unlocked");
        require(!fixedAchievementMinted[msg.sender][habitId][achievementId], "Already minted");
        fixedAchievementMinted[msg.sender][habitId][achievementId] = true;
        emit FixedAchievementMinted(msg.sender, habitId, achievementId);
    }

    /// @notice Authorize user decryption for a range of daily records (use small ranges if gas is a concern)
    function authorizeDailyRecords(uint256 habitId, uint256 fromIndex, uint256 toIndex) external {
        require(
            habits[msg.sender][habitId].isActive || habits[msg.sender][habitId].isArchived,
            "Habit not found"
        );
        require(toIndex <= recordCount[msg.sender][habitId], "Out of bounds");
        for (uint256 i = fromIndex; i < toIndex; i++) {
            euint32 p = dailyRecords[msg.sender][habitId][i].progress;
            FHE.allowThis(p);
            FHE.allow(p, msg.sender);
        }
    }

    /// @notice Convenience function to authorize all records for a habit
    function authorizeAllDailyRecords(uint256 habitId) external {
        uint256 count = recordCount[msg.sender][habitId];
        require(
            habits[msg.sender][habitId].isActive || habits[msg.sender][habitId].isArchived,
            "Habit not found"
        );
        for (uint256 i = 0; i < count; i++) {
            euint32 p = dailyRecords[msg.sender][habitId][i].progress;
            FHE.allowThis(p);
            FHE.allow(p, msg.sender);
        }
    }

    /// @notice Get habit information
    /// @param habitId The ID of the habit
    /// @return id The habit ID
    /// @return name The habit name
    /// @return category The habit category
    /// @return isActive Whether the habit is active
    /// @return isArchived Whether the habit is archived
    /// @return createdAt When the habit was created
    function getHabit(uint256 habitId)
        external
        view
        returns (
            uint256 id,
            string memory name,
            string memory category,
            bool isActive,
            bool isArchived,
            uint256 createdAt
        )
    {
        Habit memory habit = habits[msg.sender][habitId];
        return (
            habit.id,
            habit.name,
            habit.category,
            habit.isActive,
            habit.isArchived,
            habit.createdAt
        );
    }

    /// @notice Get record count for a habit
    /// @param habitId The ID of the habit
    /// @return The number of records
    function getRecordCount(uint256 habitId) external view returns (uint256) {
        return recordCount[msg.sender][habitId];
    }
}

