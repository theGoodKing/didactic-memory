// scripts/update_data.ts

// --- Interfaces for strong typing ---
interface Config {
  cookie: string;
  challengeIds: string[];
}

interface ChallengeDetails {
  id: string;
  name: string;
}

interface LeaderboardPlayer {
  rank: number;
  playerName: string;
  totalScore: number;
  gamesPlayed: number;
  weightedScore: number;
  challengesWon: number;
  perfectRounds: number;
  challengeScores: { [challengeId: string]: number };
}

interface OutputData {
  challengeDetails: ChallengeDetails[];
  leaderboard: LeaderboardPlayer[];
}

// --- Main function ---
async function updateLeaderboard() {
  console.log("Starting leaderboard update...");

  // 1. Read configuration
  let config: Config;
  try {
    const configContent = await Deno.readTextFile("./config.json");
    config = JSON.parse(configContent);
    if (!config.cookie || !config.challengeIds || config.challengeIds.length === 0) {
      throw new Error("Invalid config.json. Ensure 'cookie' and 'challengeIds' are set.");
    }
  } catch (error) {
    console.error(`Error reading or parsing config.json: ${error.message}`);
    Deno.exit(1);
  }
  console.log(`Found ${config.challengeIds.length} challenges in config.`);

  // 2. Fetch and aggregate scores
  const aggregatedScores = new Map<string, {
    playerName: string;
    totalScore: number;
    gamesPlayed: number;
    totalRoundsPlayed: number;
    challengesWon: number;
    perfectRounds: number;
    challengeScores: { [challengeId: string]: number };
  }>();
  
  const challengeDetails: ChallengeDetails[] = [];

  for (const challengeId of config.challengeIds) {
    console.log(`Fetching data for challenge: ${challengeId}`);
    try {
      let cookieHeader = config.cookie;
      if (!cookieHeader.trim().startsWith("_ncfa=")) {
        cookieHeader = `_ncfa=${cookieHeader}`;
      }

      const res = await fetch(`https://www.geoguessr.com/api/v3/results/highscores/${challengeId}?limit=100`, {
        headers: { "Cookie": cookieHeader },
      });

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const results = await res.json();
      if (!results.items || !Array.isArray(results.items)) {
        throw new Error("API response is not in the expected format.");
      }

      // Get map name from the first result (it's the same for all)
      const mapName = results.items.length > 0 ? results.items[0].game.mapName : 'Unknown Map';
      challengeDetails.push({ id: challengeId, name: mapName });

      // Find the winner of this challenge
      let winnerId: string | null = null;
      let maxScore = -1;
      for (const item of results.items) {
        const score = parseInt(item.game.player.totalScore.amount, 10);
        if (score > maxScore) {
          maxScore = score;
          winnerId = item.game.player.id;
        }
      }

      // Process each player's results for the challenge
      for (const item of results.items) {
        const player = item.game.player;
        const score = parseInt(player.totalScore.amount, 10);
        const playerName = player.nick;
        const playerId = player.id;
        const numRounds = player.guesses.length;

        if (isNaN(score) || numRounds === 0) {
          console.warn(`Could not parse score or found 0 rounds for player: ${playerName}. Skipping.`);
          continue;
        }

        const existingPlayer = aggregatedScores.get(playerId) || {
          playerName: playerName,
          totalScore: 0,
          gamesPlayed: 0,
          totalRoundsPlayed: 0,
          challengesWon: 0,
          perfectRounds: 0,
          challengeScores: {},
        };

        existingPlayer.totalScore += score;
        existingPlayer.gamesPlayed += 1;
        existingPlayer.totalRoundsPlayed += numRounds;
        existingPlayer.challengeScores[challengeId] = score;

        if (playerId === winnerId) {
          existingPlayer.challengesWon += 1;
        }

        for (const guess of player.guesses) {
          if (guess.roundScoreInPoints === 5000) {
            existingPlayer.perfectRounds += 1;
          }
        }
        
        aggregatedScores.set(playerId, existingPlayer);
      }
    } catch (error) {
      console.error(`Failed to fetch or process results for challenge ${challengeId}: ${error.message}`);
    }
  }

  // 3. Process and rank players, sorting by a weighted score
  const rankedPlayers = Array.from(aggregatedScores.values())
    .map(p => {
      // Calculate a normalized average score per round
      const averageScorePerRound = p.totalRoundsPlayed > 0 ? p.totalScore / p.totalRoundsPlayed : 0;
      
      // Weighted score uses the normalized score and rewards playing more games.
      const weightedScore = averageScorePerRound * Math.log(p.gamesPlayed + 1);

      return {
        ...p,
        weightedScore, // Keep it unrounded for sorting
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
  
  // 4. Assign ranks
  const finalLeaderboard: LeaderboardPlayer[] = rankedPlayers.map((p, index) => ({
    ...p,
    rank: index + 1,
    weightedScore: Math.round(p.weightedScore), // round for display
  }));

  // 5. Create final output object
  const outputData: OutputData = {
    challengeDetails: challengeDetails,
    leaderboard: finalLeaderboard,
  };

  // 6. Write to data.json
  try {
    await Deno.writeTextFile("./docs/data.json", JSON.stringify(outputData, null, 2));
    console.log(`Successfully wrote leaderboard to ./docs/data.json with ${finalLeaderboard.length} players.`);
  } catch (error) {
    console.error(`Error writing to file: ${error.message}`);
    Deno.exit(1);
  }
}

// --- Run the script ---
if (import.meta.main) {
  updateLeaderboard();
}

